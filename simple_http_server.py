#!/usr/bin/env python3
"""
Simple HTTP Server with proper MIME types for ES6 modules
"""
import http.server
import socketserver
import mimetypes
import os

# Add/override MIME types for JavaScript modules
mimetypes.init()
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('text/css', '.css')

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Ensure proper MIME type for JavaScript
        if self.path.endswith('.js') or self.path.endswith('.mjs'):
            # Proper MIME type is handled by guess_type, but we ensure charset here if needed
            # or just rely on guess_type. 
            # If we want to force charset, we might need to verify if send_head allows it.
            # SimpleHTTPRequestHandler usually just sends the type.
            # Let's trust guess_type for the type, and maybe add charset if missing?
            # actually, duplicate headers are bad. Let's remove this explicitly.
            pass
        super().end_headers()

    def guess_type(self, path):
        """Override to ensure .js files are served with correct MIME type"""
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'text/javascript'
        return super().guess_type(path)

def run_server(port=5500, bind='127.0.0.1'):
    """Run the HTTP server"""
    with socketserver.TCPServer((bind, port), CustomHTTPRequestHandler) as httpd:
        print(f" [+] Frontend Server Running")
        print(f" [+] URL: http://{bind}:{port}")
        print(f" [+] Serving directory: {os.getcwd()}")
        print(f" [+] MIME Types configured for ES6 modules")
        print(f"\nPress Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped")

if __name__ == "__main__":
    run_server()
