# User Model (`src/models/user.model.ts`)

Represents an application user.

## Schema Definition

```typescript
{
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
}
```

-   `email` (String, Required, Unique): The user's unique email address, used for login.
-   `password` (String, Required): The user's hashed password.
-   `name` (String, Required): The user's display name.
-   `role` (String, Enum['admin', 'member'], Default: 'member'): The user's role within the application.

*Timestamps (`createdAt`, `updatedAt`) are automatically added.* 

## Features

-   **Password Hashing:** Uses a `pre('save')` hook with `bcryptjs` to automatically hash the password before saving a new or modified user document.
-   **Password Comparison:** Provides an instance method `comparePassword(candidatePassword: string)` that uses `bcryptjs.compare` to check if a provided password matches the stored hash.

## Enum: `UserRole`

Defines the possible roles a user can have:
-   `ADMIN = 'admin'`
-   `MEMBER = 'member'`

## Relationships

-   **AIChatHistory:** A user can have one associated `AIChatHistory` document (linked via `userId` in `AIChatHistory`).
-   **Audit:** A user can perform many `Audit` actions (linked via `userId` in `Audit`). 