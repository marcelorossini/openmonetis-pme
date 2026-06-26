type ClientColumnCandidate = {
	clientId?: string | null;
	clientName?: string | null;
};

export function shouldShowClientColumn(items: ClientColumnCandidate[]) {
	return items.some(
		(item) => Boolean(item.clientId) || Boolean(item.clientName?.trim()),
	);
}
