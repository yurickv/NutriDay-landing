// One-off per environment: registers Sytno as an OAuth client on the Silpo MCP
// server (RFC 7591 dynamic registration) and prints the client_id to put into
// SILPO_MCP_CLIENT_ID.
//
// Usage: node scripts/silpo-register-client.mjs https://your-domain
const appUrl = process.argv[2]?.replace(/\/$/, '');
if (!appUrl) {
  console.error('Usage: node scripts/silpo-register-client.mjs <APP_URL>');
  process.exit(1);
}
const redirect = `${appUrl}/api/silpo/callback`;
const res = await fetch('https://mcp.silpo.ua/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'Sytno',
    client_uri: appUrl,
    redirect_uris: [redirect],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error('Registration failed', res.status, body);
  process.exit(1);
}
console.log(`Registered. redirect_uri=${redirect}`);
console.log(`SILPO_MCP_CLIENT_ID=${body.client_id}`);
