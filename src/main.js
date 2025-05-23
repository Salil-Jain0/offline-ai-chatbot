// Global chatbot instance
let chatbot;
let modelDownloader;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Offline AI Chatbot...');
    
    try {
        chatbot = new OfflineChatbot();
        modelDownloader = new ModelDownloader();
        
        // Setup event listeners
        setupEventListeners();
        
        // Show recommended models
        showRecommendedModels();
        
        console.log('✅ Offline Chatbot initialized successfully');
        
        // Check if WASM files are available
        checkWasmAvailability();
        
    } catch (error) {
        console.error('❌ Failed to initialize chatbot:', error);
        showInitializationError(error);
    }
});

async function checkWasmAvailability() {
    try {
        const wasmResponse = await fetch('/wasm/main.wasm');
        const jsResponse = await fetch('/wasm/main.js');
        
        if (wasmResponse.ok && jsResponse.ok) {
            console.log('✅ WASM files are available');
            updateStatusMessage('WASM files detected - Ready for real AI!');
        } else {
            console.warn('⚠️ WASM files not found');
            showWasmMissingWarning();
        }
    } catch (error) {
        console.warn('⚠️ Could not check WASM availability:', error);
        showWasmMissingWarning();
    }
}

function showWasmMissingWarning() {
    const setupPanel = document.getElementById('setupPanel');
    if (setupPanel) {
        const warningDiv = document.createElement('div');
        warningDiv.innerHTML = `
            <div class="error-box">
                <strong>⚠️ WebAssembly Files Missing</strong><br>
                Real AI functionality requires WebAssembly files to be built.<br><br>
                
                <strong>To enable real offline AI:</strong><br>
                1. Install Emscripten SDK<br>
                2. Run: <code>python build.py</code><br>
                3. Reload this page<br><br>
                
                <strong>For now, you can try Demo Mode below.</strong>
            </div>
        `;
        setupPanel.appendChild(warningDiv);
    }
}

function showInitializationError(error) {
    const container = document.querySelector('.chat-container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div class="error-box" style="margin: 20px;">
                <strong>❌ Initialization Error</strong><br>
                ${error.message}<br><br>
                Please refresh the page and try again.
            </div>
        `;
        container.insertBefore(errorDiv, container.firstChild);
    }
}

function updateStatusMessage(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function setupEventListeners() {
    // Enter key for sending messages
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // File input change
    const modelFileInput = document.getElementById('modelFile');
    if (modelFileInput) {
        modelFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const loadButton = document.getElementById('loadButton');
                if (loadButton) {
                    loadButton.disabled = false;
                }
                
                // Show file info
                showFileInfo(file);
            }
        });
    }

    // Setup drag and drop if elements exist
    setupDragAndDrop();
}

function showFileInfo(file) {
    const setupPanel = document.getElementById('setupPanel');
    if (!setupPanel) return;
    
    // Remove existing file info
    const existingInfo = setupPanel.querySelector('.file-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
        <div class="info-box">
            <strong>📁 Selected Model:</strong><br>
            Name: ${file.name}<br>
            Size: ${(file.size / 1024 / 1024).toFixed(1)} MB<br>
            Type: ${file.type || 'application/octet-stream'}
        </div>
    `;
    
    setupPanel.appendChild(fileInfo);
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('setupPanel');
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.style.backgroundColor = '#f0f0f0';
        dropZone.style.border = '2px dashed #667eea';
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
        dropZone.style.border = '';
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
        dropZone.style.border = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.gguf')) {
                const modelFileInput = document.getElementById('modelFile');
                if (modelFileInput) {
                    // Create a new FileList-like object
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    modelFileInput.files = dt.files;
                    
                    const loadButton = document.getElementById('loadButton');
                    if (loadButton) {
                        loadButton.disabled = false;
                    }
                    
                    showFileInfo(file);
                }
            } else {
                alert('Please drop a valid GGUF model file (.gguf extension)');
            }
        }
    });
}

function showRecommendedModels() {
    if (!modelDownloader) return;
    
    const models = modelDownloader.getRecommendedModels();
    const setupPanel = document.getElementById('setupPanel');
    
    if (!setupPanel) return;
    
    const modelsDiv = document.createElement('div');
    modelsDiv.className = 'recommended-models';
    modelsDiv.innerHTML = `
        <h3>🤖 Recommended AI Models:</h3>
        <div class="model-list">
            ${models.map(model => `
                <div class="model-option" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background: white;">
                    <strong>${model.name}</strong> <span style="color: #666;">(${model.size})</span><br>
                    <small style="color: #888;">${model.description}</small><br>
                    <button onclick="downloadRecommendedModel('${model.url}', '${model.name}')" 
                            class="download-btn" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📥 Download & Load
                    </button>
                </div>
            `).join('')}
        </div>
        
        <div style="margin: 20px 0;">
            <strong>Or upload your own GGUF model:</strong><br>
            <input type="file" id="modelFile" accept=".gguf" style="margin: 10px 0;">
            <button onclick="loadModel()" id="loadButton" disabled 
                    style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                🚀 Load Model
            </button>
        </div>
    `;
    
    setupPanel.appendChild(modelsDiv);
}

async function downloadRecommendedModel(url, name) {
    if (!chatbot || !modelDownloader) {
        alert('Chatbot not initialized properly');
        return;
    }
    
    try {
        const downloadButton = event.target;
        downloadButton.disabled = true;
        downloadButton.textContent = '⏳ Downloading...';
        
        chatbot.updateStatus(`Downloading ${name}...`);
        chatbot.showProgress(0);
        
        console.log('Starting download:', url);
        
        const modelBuffer = await modelDownloader.downloadModel(url, (progress) => {
            chatbot.showProgress(progress);
            console.log(`Download progress: ${progress.toFixed(1)}%`);
        });
        
        console.log('Download completed, buffer size:', modelBuffer.byteLength);
        
        // Create a File object from the buffer
        const file = new File([modelBuffer], `${name.replace(/\s+/g, '-')}.gguf`, { 
            type: 'application/octet-stream' 
        });
        
        // Load the model
        chatbot.updateStatus('Loading model into AI engine...');
        const success = await chatbot.loadModel(file);
        
        if (!success) {
            downloadButton.disabled = false;
            downloadButton.textContent = '📥 Download & Load';
        }
        
    } catch (error) {
        console.error('Download/load failed:', error);
        chatbot.showError(`Failed to download/load model: ${error.message}`);
        chatbot.updateStatus('Download failed');
        
        const downloadButton = event.target;
        downloadButton.disabled = false;
        downloadButton.textContent = '📥 Download & Load';
    }
}

async function loadModel() {
    if (!chatbot) {
        alert('Chatbot not initialized');
        return;
    }
    
    const fileInput = document.getElementById('modelFile');
    const file = fileInput?.files[0];
    
    if (!file) {
        alert('Please select a model file first.');
        return;
    }

    if (!file.name.endsWith('.gguf')) {
        alert('Please select a valid GGUF model file.');
        return;
    }

    const loadButton = document.getElementById('loadButton');
    if (loadButton) {
        loadButton.disabled = true;
        loadButton.textContent = '⏳ Loading...';
    }

    console.log('Loading model:', file.name, 'Size:', file.size);
    const success = await chatbot.loadModel(file);
    
    if (!success && loadButton) {
        loadButton.disabled = false;
        loadButton.textContent = '🚀 Load Model';
    }
}

async function sendMessage() {
    if (!chatbot) {
        console.error('Chatbot not initialized');
        return;
    }
    
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (!message) return;
    
    if (chatbot.isGenerating) {
        console.log('Already generating response...');
        return;
    }

    console.log('Sending message:', message);

    // Add user message
    chatbot.addUserMessage(message);
    input.value = '';

    // Show typing indicator
    chatbot.showTyping();

    try {
        // Generate and add bot response
        const response = await chatbot.generateResponse(message);
        chatbot.hideTyping();
        chatbot.addBotMessage(response);
        
        console.log('Response generated:', response);
    } catch (error) {
        console.error('Failed to generate response:', error);
        chatbot.hideTyping();
        chatbot.addBotMessage('Sorry, I encountered an error processing your message.');
    }
}

// Utility functions
function clearChat() {
    if (!chatbot) return;
    
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="message bot">
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    Chat history cleared! How can I help you?
                </div>
            </div>
        `;
        chatbot.conversationHistory = [];
    }
}

function exportChat() {
    if (!chatbot || !chatbot.conversationHistory.length) {
        alert('No conversation history to export');
        return;
    }
    
    const history = chatbot.conversationHistory;
    const chatText = history.map(exchange => 
        `Human: ${exchange.user}\nAssistant: ${exchange.bot}\n\n`
    ).join('');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Demo mode for testing without real AI
function enableDemoMode() {
    if (!chatbot) return;
    
    chatbot.isLoaded = true;
    chatbot.updateStatus('Demo Mode - Simulated AI Responses');
    
    const setupPanel = document.getElementById('setupPanel');
    if (setupPanel) {
        setupPanel.style.display = 'none';
    }
    
    chatbot.enableChat();
    chatbot.addBotMessage("Demo mode enabled! I'm simulating AI responses. For real offline AI, please build the WebAssembly files using the build script.");
    
    // Override generateResponse for demo mode
    chatbot.generateResponse = async function(userMessage) {
        await this.sleep(1000 + Math.random() * 2000);
        
        const responses = [
            "That's an interesting question! In demo mode, I can only provide simulated responses.",
            "I understand what you're asking about. For real AI responses, please load a GGUF model.",
            "Demo mode is active - this is a simulated response. The real AI would provide much better answers!",
            "Thanks for your message! This is just a demo response. Real offline AI requires WebAssembly compilation.",
            "I appreciate your input! In full mode, I'd analyze your question more thoroughly.",
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    };
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

// Service worker registration for offline capability
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker registered successfully');
            })
            .catch(function(error) {
                console.log('❌ Service Worker registration failed:', error);
            });
    });
}