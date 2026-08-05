import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

import { LoadingScreen } from "./auth/LoadingScreen";
import { LoginScreen } from "./auth/LoginScreen";
import { UpdatePasswordScreen } from "./auth/UpdatePasswordScreen";

const loadAdminApp = () => import("./AdminApp");
const AdminApp = lazy(loadAdminApp);
const supabase = getSupabase();

/**
 * Keep the public entrypoint small. The complete operations workspace only
 * needs to be downloaded once an authenticated session exists.
 */
export default function AdminBootstrap() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Warm the workspace chunk while the sign-in form is still on screen, so
    // signing in does not wait for a download it could have done earlier.
    void loadAdminApp();

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <LoginScreen />;
  if (passwordRecovery) return <UpdatePasswordScreen onComplete={() => setPasswordRecovery(false)} />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminApp session={session} />
    </Suspense>
  );
}
