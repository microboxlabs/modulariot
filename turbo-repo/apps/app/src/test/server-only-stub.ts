// Stand-in for the "server-only" guard package so server modules can be
// unit-tested outside the Next.js server runtime. The real package has no
// exports (it's imported for its side effect only); this named export exists
// solely to keep the file a module under isolatedModules.
export const serverOnlyTestStub = true;
