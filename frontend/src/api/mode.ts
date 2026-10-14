// True when the app runs on the sample data (tests, and `VITE_API=mock`) instead of the venue server
export const usingMocks: boolean = typeof __USE_MOCKS__ !== 'undefined' && __USE_MOCKS__
