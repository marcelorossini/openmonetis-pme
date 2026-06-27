type PartyColumnCandidate = {
	partyId?: string | null;
	partyName?: string | null;
};

export function shouldShowPartyColumn(items: PartyColumnCandidate[]) {
	return items.some(
		(item) => Boolean(item.partyId) || Boolean(item.partyName?.trim()),
	);
}
