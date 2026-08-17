import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { App } from "./App";
import { NotFoundPage } from "./components/NotFoundPage";
import { RouteErrorPage } from "./components/RouteErrorPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: null },
      {
        path: "dev",
        lazy: async () => {
          const { DevPage } = await import("./components/DevPage");
          return { Component: DevPage };
        },
      },
      {
        path: "blog",
        children: [
          {
            index: true,
            lazy: async () => {
              const { BlogIndexPage } = await import("./components/BlogIndexPage");
              return { Component: BlogIndexPage };
            },
          },
          {
            path: ":slug",
            lazy: async () => {
              const { BlogPostPage } = await import("./components/BlogPostPage");
              return { Component: BlogPostPage };
            },
          },
        ],
      },
      {
        path: "news",
        children: [
          {
            index: true,
            lazy: async () => {
              const { BulletinIndexPage } = await import("./components/BulletinIndexPage");
              return { Component: BulletinIndexPage };
            },
          },
          {
            path: ":slug",
            lazy: async () => {
              const { BulletinPage } = await import("./components/BulletinPage");
              return { Component: BulletinPage };
            },
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage />, errorElement: <RouteErrorPage /> },
]);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

const shell = document.getElementById("app-shell");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

if (shell) {
  window.requestAnimationFrame(() => {
    shell.remove();
  });
}
