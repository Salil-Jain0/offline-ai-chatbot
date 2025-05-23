class ModelDownloader {
    constructor() {
        this.downloadProgress = 0;
    }

    async downloadModel(modelUrl, onProgress) {
        try {
            const response = await fetch(modelUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                if (onProgress && total) {
                    const progress = (loaded / total) * 100;
                    onProgress(progress);
                }
            }

            // Combine chunks into single ArrayBuffer
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            return result.buffer;
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    getRecommendedModels() {
        return [
            {
                name: "TinyLlama 1.1B Chat",
                size: "637 MB",
                url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.q4_k_m.gguf",
                description: "Fast and lightweight model, good for basic conversations"
            },
            {
                name: "Phi-2 2.7B",
                size: "1.6 GB", 
                url: "https://huggingface.co/microsoft/phi-2-gguf/resolve/main/phi-2.q4_k_m.gguf",
                description: "Microsoft's efficient model with good reasoning capabilities"
            },
            {
                name: "Llama 2 7B Chat",
                size: "3.8 GB",
                url: "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.q4_k_m.gguf", 
                description: "High-quality conversational model (requires more RAM)"
            }
        ];
    }
}