// Web Worker for Llama.cpp to prevent UI blocking
class LlamaWorker {
    constructor() {
        this.model = null;
        this.context = null;
        this.isLoaded = false;
        this.wasmModule = null;
    }

    async loadWasm() {
        try {
            // Try to load the WebAssembly module
            // First check if we have the WASM files available
            const wasmResponse = await fetch('/wasm/main.wasm');
            if (!wasmResponse.ok) {
                throw new Error('WASM file not found - please build the WebAssembly files first');
            }

            const jsResponse = await fetch('/wasm/main.js');
            if (!jsResponse.ok) {
                throw new Error('WASM JS file not found - please build the WebAssembly files first');
            }

            // Load the JavaScript module that bootstraps WASM
            const wasmModule = await import('/wasm/main.js');
            
            // Initialize the WASM module
            this.wasmModule = await wasmModule.default();
            
            console.log('WASM module loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load WASM:', error);
            throw error;
        }
    }

    async loadModel(modelBuffer) {
        try {
            if (!this.wasmModule) {
                await this.loadWasm();
            }

            console.log('Loading model with buffer size:', modelBuffer.byteLength);

            // Convert ArrayBuffer to Uint8Array for WASM
            const modelData = new Uint8Array(modelBuffer);
            
            // Initialize model with the buffer
            // Note: This assumes your WASM module exposes these functions
            // You may need to adjust based on your actual WASM interface
            if (this.wasmModule.llama_load_model_from_buffer) {
                this.model = this.wasmModule.llama_load_model_from_buffer(modelData);
            } else {
                throw new Error('WASM module does not expose model loading functions');
            }
            
            if (this.model) {
                // Create context for the model
                this.context = this.wasmModule.llama_new_context_with_model(this.model, {
                    n_ctx: 2048,
                    n_batch: 512,
                    n_threads: navigator.hardwareConcurrency || 4
                });
                
                this.isLoaded = true;
                console.log('Model loaded successfully');
                return { success: true };
            } else {
                throw new Error('Failed to initialize model');
            }
        } catch (error) {
            console.error('Model loading error:', error);
            return { success: false, error: error.message };
        }
    }

    async generateText(prompt, options = {}) {
        if (!this.isLoaded) {
            return { success: false, error: 'Model not loaded' };
        }

        try {
            const defaultOptions = {
                max_tokens: 150,
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                stop: ['\n\n', '###', 'Human:', 'Assistant:']
            };

            const settings = { ...defaultOptions, ...options };
            
            console.log('Generating text for prompt:', prompt.substring(0, 100) + '...');
            
            // Tokenize the prompt
            const tokens = this.wasmModule.llama_tokenize(this.context, prompt);
            console.log('Tokenized prompt, token count:', tokens.length);
            
            // Generate response
            const response = await this.generateTokens(tokens, settings);
            
            return { 
                success: true, 
                text: response.text,
                tokens_used: response.tokens
            };
        } catch (error) {
            console.error('Text generation error:', error);
            return { success: false, error: error.message };
        }
    }

    async generateTokens(inputTokens, settings) {
        return new Promise((resolve, reject) => {
            try {
                let generatedTokens = [];
                let generatedText = '';
                
                // Evaluate the input tokens
                if (this.wasmModule.llama_eval) {
                    this.wasmModule.llama_eval(this.context, inputTokens);
                }
                
                // Generate tokens one by one
                for (let i = 0; i < settings.max_tokens; i++) {
                    // Sample next token
                    const nextToken = this.wasmModule.llama_sample_token(
                        this.context,
                        settings.temperature,
                        settings.top_p,
                        settings.top_k,
                        settings.repeat_penalty
                    );
                    
                    if (nextToken === this.wasmModule.llama_token_eos()) {
                        break; // End of sequence
                    }
                    
                    generatedTokens.push(nextToken);
                    
                    // Convert token to text
                    const tokenText = this.wasmModule.llama_token_to_str(this.context, nextToken);
                    generatedText += tokenText;
                    
                    // Check for stop sequences
                    if (settings.stop.some(stopSeq => generatedText.includes(stopSeq))) {
                        // Remove the stop sequence from the end
                        for (const stopSeq of settings.stop) {
                            const index = generatedText.lastIndexOf(stopSeq);
                            if (index !== -1) {
                                generatedText = generatedText.substring(0, index);
                                break;
                            }
                        }
                        break;
                    }
                    
                    // Evaluate the new token
                    this.wasmModule.llama_eval(this.context, [nextToken]);
                }
                
                resolve({
                    text: generatedText.trim(),
                    tokens: generatedTokens.length
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create worker instance
const llamaWorker = new LlamaWorker();

// Handle messages from main thread
self.onmessage = async function(e) {
    const { id, type, data } = e.data;

    try {
        switch (type) {
            case 'loadModel':
                console.log('Worker: Loading model...');
                const loadResult = await llamaWorker.loadModel(data.modelBuffer);
                self.postMessage({ id, type: 'response', data: loadResult });
                break;

            case 'generateText':
                console.log('Worker: Generating text...');
                const generateResult = await llamaWorker.generateText(data.prompt, data.options);
                self.postMessage({ id, type: 'response', data: generateResult });
                break;

            case 'checkStatus':
                self.postMessage({ 
                    id, 
                    type: 'response', 
                    data: { 
                        isLoaded: llamaWorker.isLoaded,
                        hasWasm: !!llamaWorker.wasmModule 
                    } 
                });
                break;

            default:
                self.postMessage({ 
                    id, 
                    type: 'response', 
                    data: { success: false, error: 'Unknown message type: ' + type } 
                });
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({ 
            id, 
            type: 'response', 
            data: { success: false, error: error.message } 
        });
    }
};