"use client";

import { createContext, useContext } from "react";

type BrandingContextValue = {
	logoUrl: string | null;
	logoFileName: string | null;
};

const BrandingContext = createContext<BrandingContextValue>({
	logoUrl: null,
	logoFileName: null,
});

type BrandingProviderProps = BrandingContextValue & {
	children: React.ReactNode;
};

export function BrandingProvider({
	children,
	logoUrl,
	logoFileName,
}: BrandingProviderProps) {
	return (
		<BrandingContext.Provider value={{ logoUrl, logoFileName }}>
			{children}
		</BrandingContext.Provider>
	);
}

export function useBranding() {
	return useContext(BrandingContext);
}
