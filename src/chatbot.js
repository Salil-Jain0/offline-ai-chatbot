class OfflineChatbot {
    constructor() {
        this.worker = null;
        this.isLoaded = false;
        this.messageQueue = new Map();
        this.messageId = 0;
        this.conversationHistory = [];
        this.isGenerating = false;
        this.initWorker();
    }

    initWorker() {
        try {
            this.worker = new Worker('/src/llama-worker.js');
            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.showError('Worker initialization failed: ' + error.message);
            };
            console.log('Worker initialized successfully');
        } catch (error) {
            console.error('Failed to create worker:', error);
            throw error;
        }
    }

    handleWorkerMessage(e) {
        const { id, type, data } = e.data;
        console.log('Received worker message:', { id, type, data });
        
        const resolve = this.messageQueue.get(id);
        
        if (resolve) {
            this.messageQueue.delete(id);
            resolve(data);
        } else {
            console.warn('No resolver found for message ID:', id);
        }
    }

    async sendWorkerMessage(type, data) {
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            const timeout = setTimeout(() => {
                this.messageQueue.delete(id);
                reject(new Error('Worker message timeout'));
            }, 30000); // 30 second timeout

            this.messageQueue.set(id, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            console.log('Sending worker message:', { id, type });
            this.worker.postMessage({ id, type, data });
        });
    }

    async checkWorkerStatus() {
        try {
            const status = await this.sendWorkerMessage('checkStatus', {});
            console.log('Worker status:', status);
            return status;
        } catch (error) {
            console.error('Failed to check worker status:', error);
            return { isLoaded: false, hasWasm: false };
        }
    }

    async loadModel(modelFile) {
        try {
            this.updateStatus('Reading model file...');
            console.log('Loading model file:', modelFile.name, 'Size:', modelFile.size);
            
            // Read the file as ArrayBuffer
            const arrayBuffer = await modelFile.arrayBuffer();
            console.log('Model file read, buffer size:', arrayBuffer.byteLength);
            
            this.updateStatus('Initializing AI model...');
            this.showProgress(25);
            
            // Send model to worker for loading
            const result = await this.sendWorkerMessage('loadModel', {
                modelBuffer: arrayBuffer
            });

            console.log('Model loading result:', result);

            if (result.success) {
                this.isLoaded = true;
                this.updateStatus('Model loaded successfully! Ready for offline AI chat.');
                this.showProgress(100);
                this.hideModelLoader();
                this.enableChat();
                this.addBotMessage("🎉 Perfect! I'm now running completely offline with real AI. Ask me anything!");
                return true;
            } else {
                throw new Error(result.error || 'Unknown model loading error');
            }
        } catch (error) {
            console.error('Model loading failed:', error);
            this.showError('Failed to load AI model: ' + error.message);
            this.updateStatus('Model loading failed');
            
            // Show detailed error information
            if (error.message.includes('WASM file not found')) {
                this.showError('WebAssembly files are missing. Please run the build script to compile llama.cpp for WebAssembly.');
            }
            
            return false;
        }
    }

    async generateResponse(userMessage) {
        if (!this.isLoaded) {
            return "Please load an AI model first using the setup panel above.";
        }

        if (this.isGenerating) {
            return "I'm still processing your previous message. Please wait...";
        }

        this.isGenerating = true;

        try {
            console.log('Generating response for:', userMessage);
            
            // Build conversation context
            const prompt = this.buildPrompt(userMessage);
            console.log('Built prompt:', prompt.substring(0, 200) + '...');
            
            // Generate response using the worker
            const result = await this.sendWorkerMessage('generateText', {
                prompt: prompt,
                options: {
                    max_tokens: 200,
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                    repeat_penalty: 1.1
                }
            });

            console.log('Generation result:', result);

            if (result.success) {
                // Clean up the response
                let response = result.text.trim();
                response = this.cleanupResponse(response);
                
                // Update conversation history
                this.conversationHistory.push({
                    user: userMessage,
                    bot: response,
                    timestamp: Date.now()
                });

                // Keep conversation history manageable
                if (this.conversationHistory.length > 10) {
                    this.conversationHistory = this.conversationHistory.slice(-8);
                }

                console.log('Final response:', response);
                return response;
            } else {
                throw new Error(result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Generation error:', error);
            return "I apologize, but I encountered an error while generating a response. Error: " + error.message;
        } finally {
            this.isGenerating = false;
        }
    }

    buildPrompt(userMessage) {
        // Improved chat template
        let prompt = "You are a helpful AI assistant. Be concise and natural in your responses.\n\n";
        
        // Add recent conversation history (last 4 exchanges)
        const recentHistory = this.conversationHistory.slice(-4);
        for (const exchange of recentHistory) {
            prompt += `Human: ${exchange.user}\nAssistant: ${exchange.bot}\n\n`;
        }
        
        prompt += `Human: ${userMessage}\nAssistant:`;
        return prompt;
    }

    cleanupResponse(response) {
        // Remove any unwanted tokens or formatting
        response = response.replace(/Human:|Assistant:|User:/gi, '').trim();
        
        // Remove common artifacts
        response = response.replace(/^[\s\n]*/, ''); // Leading whitespace
        response = response.replace(/[\s\n]*$/, ''); // Trailing whitespace
        
        // Remove repetitive patterns
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const uniqueSentences = [];
        let lastSentence = '';
        
        for (const sentence of sentences) {
            const cleanSentence = sentence.trim();
            if (cleanSentence !== lastSentence && cleanSentence.length > 0) {
                uniqueSentences.push(cleanSentence);
                lastSentence = cleanSentence;
            }
        }
        
        let result = uniqueSentences.join('. ');
        if (result && !result.match(/[.!?]$/)) {
            result += '.';
        }
        
        return result || "I understand. How can I help you further?";
    }

    // UI Methods
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('Status:', message);
    }

    showProgress(percentage) {
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        if (progressBar && progressFill) {
            progressBar.style.display = 'block';
            progressFill.style.width = percentage + '%';
        }
    }

    hideModelLoader() {
        const modelLoader = document.getElementById('setupPanel');
        if (modelLoader) {
            modelLoader.style.display = 'none';
        }
    }

    enableChat() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = "Type your message here...";
            messageInput.focus();
        }
        
        if (sendButton) {
            sendButton.disabled = false;
        }
    }

    showTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'block';
            this.scrollToBottom();
        }
    }

    hideTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-avatar">👤</div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showError(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #ffebee;
            border: 1px solid #f44336;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            color: #c62828;
        `;
        errorDiv.textContent = message;
        messagesContainer.appendChild(errorDiv);
        this.scrollToBottom();
        
        console.error('Chatbot error:', message);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}