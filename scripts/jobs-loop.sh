#!/bin/sh

set -eu

JOBS_API_BASE_URL="${JOBS_API_BASE_URL:-http://app:3000}"
JOBS_TARGET_PATH="${JOBS_TARGET_PATH:-/api/internal/jobs/recurring-financial-titles}"
JOBS_INTERVAL_SECONDS="${JOBS_INTERVAL_SECONDS:-86400}"
JOBS_RUN_ON_START="${JOBS_RUN_ON_START:-true}"

run_job() {
	node <<'EOF'
const baseUrl = process.env.JOBS_API_BASE_URL || "http://app:3000";
const targetPath =
	process.env.JOBS_TARGET_PATH ||
	"/api/internal/jobs/recurring-financial-titles";
const secret = process.env.JOBS_SECRET;

const headers = secret
	? {
			"x-openmonetis-job-secret": secret,
		}
	: {};

async function main() {
	const response = await fetch(new URL(targetPath, baseUrl), {
		method: "POST",
		headers,
	});

	const text = await response.text();
	if (!response.ok) {
		console.error(
			`Job HTTP ${response.status} ${response.statusText}: ${text}`,
		);
		process.exitCode = 1;
		return;
	}

	console.log(text);
}

main().catch((error) => {
	console.error("Falha ao executar job recorrente:", error);
	process.exitCode = 1;
});
EOF
}

if [ "$JOBS_RUN_ON_START" = "true" ]; then
	run_job || true
fi

while true; do
	sleep "$JOBS_INTERVAL_SECONDS"
	run_job || true
done
