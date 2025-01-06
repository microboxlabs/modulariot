This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Running the project

Recently the project had a migration to `pnpm`, so, to have the best experience running the app use the commands:

1. `pnpm i` to install the dependencies in your local machine.
2. `pnpm dev` to run the code on a development server.

With this done you can access to it with the URL given on the CLI, by default it might be `128.0.0.1:3000` but if that direction is in use, it might give you another one.

---

## Routing

When opening the page you’ll find yourself lose, with an error message showing that the actual route is not setted correctly, press the button “Back To Home” or go to the route `/app/en/sign-in` so you can get in the login screen.

If you take a look on the URL you might find the `en` inside of it, the main reason of this is the fact that the page is designed to work around multiple languages, these for now being:

1. `es`: for Spanish.
2. `en`: for English.

This is usually triggered by the system language, but you can manually set it by changing the URL.

---

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
