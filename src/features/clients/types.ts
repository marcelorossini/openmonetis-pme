export const CLIENT_STATUS_OPTIONS = ["Ativo", "Inativo"] as const;

export type ClientStatus = (typeof CLIENT_STATUS_OPTIONS)[number];

export type Client = {
	id: string;
	name: string;
	note: string | null;
	status: ClientStatus;
	createdAt: string;
};

export type ClientFormValues = {
	name: string;
	status: ClientStatus;
	note: string;
};
