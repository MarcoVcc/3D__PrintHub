import http.server
import os
import socketserver


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    port = 8000
    handler = NoCacheHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Static server su http://127.0.0.1:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
