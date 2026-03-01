import { useEffect, useMemo, useState } from "react";
import type { DesktopApi, DesktopState } from "../../shared/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui-kit/index.js";
import { GooseIcon } from "./icons/index.js";

const HomePage = ({ state }: { state: DesktopState | null }) => {
  const status = useMemo(() => {
    if (!state) {
      return "Backend status: loading";
    }
    if (state.backendError) {
      return `Backend status: error (${state.backendError})`;
    }
    if (state.backendUrl) {
      return `Backend status: ready (${state.backendUrl})`;
    }
    return "Backend status: starting";
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Home</CardTitle>
      </CardHeader>
      <CardContent>
        <p data-testid="backend-status">{status}</p>
      </CardContent>
    </Card>
  );
};

export const DesktopApp = ({ desktopApi }: { desktopApi: DesktopApi }) => {
  const [state, setState] = useState<DesktopState | null>(null);

  useEffect(() => {
    void desktopApi.getState().then(setState);
  }, [desktopApi]);

  return (
    <main className="mx-auto my-6 grid w-full max-w-4xl gap-4 rounded-xl border border-border-default bg-background-default p-5 shadow-sm">
      <header className="flex items-center gap-3">
        <GooseIcon className="h-8 w-8" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Agent Desktop</h1>
      </header>
      <HomePage state={state} />
    </main>
  );
};
