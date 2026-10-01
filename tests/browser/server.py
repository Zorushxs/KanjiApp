# Servidor de proves: serveix l'arrel del repo i desa a tests/browser/result.txt el que l'arnès envia per POST.
# Ús: python tests/browser/server.py [port]   (per defecte 8767)
import http.server, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, '..', '..'))

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # /slow?ms=3000 respon tard: endarrereix el "load" de la pàgina per fer la captura amb tot carregat.
        if self.path.startswith('/slow'):
            import time, urllib.parse
            ms = int(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('ms', ['3000'])[0])
            time.sleep(ms / 1000)
            self.send_response(200)
            self.send_header('Content-Type', 'image/gif')
            self.end_headers()
            self.wfile.write(b'GIF89a\x01\x00\x01\x00\x00\x00\x00;')
            return
        super().do_GET()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        with open(os.path.join(HERE, 'result.txt'), 'wb') as f:
            f.write(body)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
print(f'Proves a http://127.0.0.1:{port}/tests/browser/harness.html')
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
