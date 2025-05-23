#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from pathlib import Path

def check_dependencies():
    """Check if required tools are available"""
    required_tools = ['git', 'cmake', 'make']
    
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"❌ {tool} is not installed. Please install it first.")
            return False
    
    # Check for Emscripten
    if not shutil.which('emcc'):
        print("❌ Emscripten is not installed or not in PATH.")
        print("Please install Emscripten from https://emscripten.org/docs/getting_started/downloads.html")
        return False
    
    print("✅ All dependencies found!")
    return True

def clone_llama_cpp():
    """Clone llama.cpp repository if not exists"""
    if os.path.exists('llama.cpp'):
        print("✅ llama.cpp repository already exists")
        return True
    
    print("📥 Cloning llama.cpp repository...")
    try:
        subprocess.run([
            'git', 'clone', 
            'https://github.com/ggerganov/llama.cpp.git'
        ], check=True)
        print("✅ llama.cpp cloned successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to clone llama.cpp: {e}")
        return False

def build_wasm():
    """Build llama.cpp for WebAssembly"""
    if not os.path.exists('llama.cpp'):
        print("❌ llama.cpp directory not found")
        return False
    
    print("🔨 Building llama.cpp for WebAssembly...")
    
    try:
        # Change to llama.cpp directory
        os.chdir('llama.cpp')
        
        # Create build directory
        build_dir = 'build-em'
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
        os.makedirs(build_dir)
        
        # Configure with CMake for Emscripten
        print("⚙️  Configuring with CMake...")
        cmake_cmd = [
            'emcmake', 'cmake', '..',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DLLAMA_WASM=ON',
            '-DLLAMA_BLAS=OFF',
            '-DLLAMA_METAL=OFF',
            '-DLLAMA_CUDA=OFF',
            '-DLLAMA_OPENCL=OFF',
            '-DLLAMA_VULKAN=OFF',
            '-DCMAKE_C_FLAGS=-O3 -DNDEBUG -flto',
            '-DCMAKE_CXX_FLAGS=-O3 -DNDEBUG -flto'
        ]
        
        subprocess.run(cmake_cmd, cwd=build_dir, check=True)
        
        # Build
        print("🔧 Building...")
        subprocess.run([
            'emmake', 'make', '-j4', 'main'
        ], cwd=build_dir, check=True)
        
        # Go back to root directory
        os.chdir('..')
        
        print("✅ Build completed successfully!")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        os.chdir('..')  # Make sure we're back in root
        return False

def copy_wasm_files():
    """Copy built WASM files to the project"""
    print("📁 Copying WASM files...")
    
    # Create wasm directory if it doesn't exist
    os.makedirs('wasm', exist_ok=True)
    
    # Define source and destination paths
    wasm_files = [
        ('llama.cpp/build-em/bin/main.wasm', 'wasm/main.wasm'),
        ('llama.cpp/build-em/bin/main.js', 'wasm/main.js')
    ]
    
    success = True
    for src, dst in wasm_files:
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"✅ Copied {os.path.basename(src)}")
        else:
            print(f"❌ {src} not found")
            success = False
    
    return success

def create_wasm_wrapper():
    """Create a wrapper for the WASM module"""
    wrapper_content = '''// WebAssembly wrapper for llama.cpp
let wasmModule = null;

async function initWasm() {
    if (wasmModule) return wasmModule;
    
    try {
        // Import the generated JS file
        const Module = await import('./main.js');
        
        // Initialize the module
        wasmModule = await Module.default();
        
        console.log('WASM module initialized successfully');
        return wasmModule;
    } catch (error) {
        console.error('Failed to initialize WASM module:', error);
        throw error;
    }
}

// Export for use in workers and main thread
export default initWasm;
export { initWasm };
'''
    
    with open('wasm/init.js', 'w') as f:
        f.write(wrapper_content)
    
    print("✅ Created WASM wrapper")

def setup_project_structure():
    """Ensure proper project structure"""
    directories = ['src', 'wasm']
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Directory {directory} ready")

def create_test_page():
    """Create a simple test page to verify the build"""
    test_content = '''<!DOCTYPE html>
<html>
<head>
    <title>WASM Build Test</title>
</head>
<body>
    <h1>WASM Build Test</h1>
    <div id="status">Testing WASM module...</div>
    
    <script type="module">
        async function testWasm() {
            const statusDiv = document.getElementById('status');
            
            try {
                const initWasm = await import('./wasm/init.js');
                const wasmModule = await initWasm.default();
                
                statusDiv.innerHTML = '✅ WASM module loaded successfully!';
                statusDiv.style.color = 'green';
                
                console.log('WASM module:', wasmModule);
            } catch (error) {
                statusDiv.innerHTML = '❌ WASM module failed to load: ' + error.message;
                statusDiv.style.color = 'red';
                
                console.error('WASM test failed:', error);
            }
        }
        
        testWasm();
    </script>
</body>
</html>'''
    
    with open('test.html', 'w') as f:
        f.write(test_content)
    
    print("✅ Created test page (test.html)")

def main():
    print("🚀 Building Offline AI Chatbot with llama.cpp WebAssembly")
    print("=" * 60)
    
    # Check dependencies
    if not check_dependencies():
        print("\n❌ Please install missing dependencies and try again.")
        sys.exit(1)
    
    # Setup project structure
    setup_project_structure()
    
    # Clone llama.cpp if needed
    if not clone_llama_cpp():
        sys.exit(1)
    
    # Build WebAssembly
    if not build_wasm():
        sys.exit(1)
    
    # Copy WASM files
    if not copy_wasm_files():
        print("❌ Failed to copy some WASM files")
        sys.exit(1)
    
    # Create wrapper
    create_wasm_wrapper()
    
    # Create test page
    create_test_page()
    
    print("\n🎉 Build completed successfully!")
    print("\nNext steps:")
    print("1. Start a local server: python -m http.server 8000")
    print("2. Open http://localhost:8000/test.html to test WASM")
    print("3. If test passes, open http://localhost:8000 for the full chatbot")
    print("4. Download a GGUF model file (like TinyLlama) to test")
    
    print("\nRecommended test model:")
    print("https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.q4_k_m.gguf")

if __name__ == "__main__":
    main()