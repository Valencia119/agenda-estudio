import { createContext, useContext } from 'react';

// Fotógrafas del estudio, disponibles en toda la app
export const StudioCtx = createContext({ members: [], memberById: {}, me: null, multi: false });
export const useStudio = () => useContext(StudioCtx);
