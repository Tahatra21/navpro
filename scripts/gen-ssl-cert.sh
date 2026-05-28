#!/bin/sh
# NAVPRO — Generate self-signed SSL certificate for development/staging.
# For production, replace with Let's Encrypt or corporate CA certificate.

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
  echo "[navpro] SSL certs already exist at $CERT_DIR. Skipping."
  echo "         Delete them and re-run to regenerate."
  exit 0
fi

echo "[navpro] Generating self-signed SSL certificate (dev/staging only)..."
openssl req -x509 \
  -newkey rsa:4096 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -days 365 \
  -nodes \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=NAVPRO Enterprise/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "[navpro] ✓ SSL cert generated: $CERT_DIR/"
echo ""
echo "  For production, replace with certificates from:"
echo "  - Let's Encrypt: certbot certonly --standalone -d yourdomain.com"
echo "  - Corporate CA: contact your IT security team"
echo ""
echo "  NOTE: This self-signed cert will show browser warnings."
echo "  Add it to your OS trust store for local dev:"
echo "  macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/server.crt"
