// src/types/express.d.ts

// This allows us to attach custom properties to the Express Request object.
declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      // Add any other properties you have in your JWT payload
      // email?: string;
    };
  }
}
