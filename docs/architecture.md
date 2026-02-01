# Architecture

## Overview
Funtime is a real-time messaging platform with secure, end-to-end encrypted (E2E) messaging and live media.

## Trust boundaries
1. **Client (trusted for content):**
   - The client (web/mobile) is the only place where plaintext message content and media are decrypted.
   - Key material for E2E encryption is generated, stored, and used on the client.
2. **Server (untrusted for content):**
   - The API server provides identity, routing, metadata storage, and delivery.
   - **E2E encryption means the server cannot decrypt message content**; it only stores and routes ciphertext and metadata required for delivery.
3. **Media relay (untrusted for content):**
   - The media relay (SFU) handles WebRTC session negotiation and packet routing.
   - Media streams are encrypted end-to-end between clients; the relay cannot decrypt the media content.

## Data flow (high level)
- Clients exchange public keys and establish E2E sessions via the API server.
- Messages are encrypted on the sender client, stored as ciphertext, and delivered to recipients.
- Media streams are negotiated with the relay; packets remain encrypted in transit.

## Security notes
- Metadata (e.g., timestamps, routing identifiers) may be visible to the server, but message content is not.
- Key rotation and verification flows are handled by the client key management module.
