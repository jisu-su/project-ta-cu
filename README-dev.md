# Ta-Cu

Ta-Cu is a bike-sharing style app with Firebase Auth, an Express API, and a web client that can be deployed to Cloudflare Pages.

## Security Rules

- Authentication is based on Firebase Auth only.
- The server trusts `req.user.uid` from the verified Firebase ID token.
- Client-supplied `userId` values are not used for authorization.
- Resource access is checked on the server by comparing ownership against `req.user.uid`.
- Protected routes require `Authorization: Bearer <firebase-id-token>`.

## Error Response Rules

All API errors use the same JSON envelope:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "The request is invalid."
  }
}
```

### Status Code Rules

- `401` means authentication is missing or invalid.
- `403` means the authenticated user does not own the resource.
- `404` means the resource does not exist.
- `400` means the request is missing required input or is otherwise invalid.
- `410` means an old endpoint is no longer used.
- `500` means the server hit an unexpected failure.

### Common Codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `BAD_REQUEST`
- `GONE`
- `INTERNAL_ERROR`

## Development

- Server: `server/`
- Client: `client/`

Typical local commands:

```bash
cd server
npm run dev

cd client
npm run web
```

## Environment Variables

Client-side runtime values should live in `client/.env` and use the `EXPO_PUBLIC_*` prefix.

Example:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-api-host.example.com
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

## Notes

- Firebase Auth persistence is configured in code, not in the Firebase Console.
- Cloudflare Pages is used for the client build output.
- The API server still requires a publicly reachable URL, such as a tunnel or hosted backend.
