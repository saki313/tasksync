"use client";

/**
 * Provider et hooks d'état de synchronisation.
 *
 * Expose l'état du moteur (en ligne / hors ligne / synchronisation /
 * en attente / erreur) au travers de useSyncExternalStore, et initialise
 * le moteur avec l'utilisateur de la session (ou l'utilisateur local en
 * mode hors connexion).
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  getSyncState,
  initEngine,
  setAuthLostHandler,
  startEngine,
  stopEngine,
  subscribeSyncState,
  syncNow,
  type SyncState,
} from "@/lib/offline/sync-engine";
import { getLocalUser, type LocalUser } from "@/lib/offline/db";

interface SyncContextValue {
  state: SyncState;
  syncNow: () => Promise<void>;
}

const SyncContext = React.createContext<SyncContextValue>({
  state: getSyncState(),
  syncNow,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // État du moteur partagé aux composants.
  const state = React.useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
  const context = React.useMemo(() => ({ state, syncNow }), [state]);

  // Conflits : notification non silencieuse (jamais d'écrasement invisible).
  React.useEffect(() => {
    const handler = () =>
      toast.info("Conflit résolu", {
        description:
          "Le même élément a été modifié sur un autre appareil : la version la plus récente a été conservée.",
      });
    window.addEventListener("tasksync:conflict", handler);
    return () => window.removeEventListener("tasksync:conflict", handler);
  }, []);

  // Session perdue côté serveur (401) : recharger pour repasser à l'écran
  // de connexion (uniquement en ligne, sinon ce n'est qu'une panne réseau).
  React.useEffect(() => {
    setAuthLostHandler(() => {
      if (navigator.onLine) window.location.reload();
    });
    return () => setAuthLostHandler(null);
  }, []);

  // Initialisation du moteur selon l'état de session.
  React.useEffect(() => {
    if (status === "authenticated") {
      startEngine();
      const user = session?.user as
        | { id?: string; email?: string; name?: string | null; image?: string | null }
        | undefined;
      if (user?.id && user.email) {
        void initEngine({
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      }
      return;
    }
    if (status === "unauthenticated") {
      // Session non vérifiable par le serveur (panne réseau ou reprise hors
      // connexion) : tant qu'un utilisateur local existe, le moteur continue
      // — un 401 du serveur provoquera la déconnexion via authLost.
      void (async () => {
        const local = await getLocalUser();
        if (local) {
          startEngine();
          await initEngine(local);
        } else {
          stopEngine();
        }
      })();
    }
  }, [status, session]);

  return <SyncContext.Provider value={context}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return React.useContext(SyncContext);
}

/** Utilisateur local persistant (mode hors connexion, affichage). */
export function useLocalUser(): LocalUser | null {
  const [user, setUser] = React.useState<LocalUser | null>(null);
  React.useEffect(() => {
    void getLocalUser().then(setUser);
  }, []);
  return user;
}
