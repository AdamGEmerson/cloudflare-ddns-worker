export interface Env {
	API_KEY: SecretsStoreSecret;
	ZONE_ID: SecretsStoreSecret;
	RECORD_ID: SecretsStoreSecret;
	SECRET_KEY: SecretsStoreSecret;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
			const url = new URL(request.url);
			const CLOUDFLARE_API_TOKEN = await env.API_KEY.get();
			const ZONE_ID = await env.ZONE_ID.get();
			const RECORD_ID = await env.RECORD_ID.get();
			const SECRET_KEY = await env.SECRET_KEY.get();

			const authHeader = request.headers.get("Authorization");
			if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
					return new Response("Unauthorized", { status: 403 });
			}

			if (url.pathname === "/update") {
					const newIp = request.headers.get("CF-Connecting-IP");
					if (!newIp) return new Response("No IP found", { status: 400 });

					// Get current A record IP
					const dnsResponse = await fetch(
							`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}`,
							{
									method: "GET",
									headers: {
											"Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
											"Content-Type": "application/json"
									}
							}
					);
					const dnsResult = await dnsResponse.json() as any;
					if (!dnsResult.success) {
							return new Response("Failed to fetch DNS record", { status: 500 });
					}
					const currentARecordIp = dnsResult.result.content;

					// Check if IP has changed
					if (newIp === currentARecordIp) {
							return new Response(`IP unchanged: ${newIp}`, { status: 200 });
					}

					// Update A record if changed
					const updateResponse = await fetch(
							`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}`,
							{
									method: "PATCH",
									headers: {
											"Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
											"Content-Type": "application/json"
									},
									body: JSON.stringify({
											type: "A",
											name: "home.domain.com",
											content: newIp,
											ttl: 1,
											proxied: true
									})
							}
					);

					const updateResult = await updateResponse.json() as any;
					if (!updateResult.success) {
							return new Response("Failed to update DNS", { status: 500 });
					}

					return new Response(`IP updated: ${newIp}`, { status: 200 });
			}

			return new Response("Invalid request", { status: 400 });
	}
}