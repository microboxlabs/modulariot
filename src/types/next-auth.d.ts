import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      groups: string[];
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    groups: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    groups: string[];
  }
}
