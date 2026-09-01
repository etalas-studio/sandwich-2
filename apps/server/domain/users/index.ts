// domain/users/index.ts
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  role: "user" | "admin";
  createdAt: Date;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
