import type { PropsWithChildren, ReactElement } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../app/Providers";

export function renderApp(ui: ReactElement, initialEntry = "/login") {
  function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={[initialEntry]}><Providers>{children}</Providers></MemoryRouter>;
  }
  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper }) };
}
