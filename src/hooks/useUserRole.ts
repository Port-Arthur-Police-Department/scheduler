import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "supervisor" | "officer" | "chaplain";

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) throw error;

        setRoles(data?.map((r) => r.role as UserRole) || []);
      } catch (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  const hasRole = (role: UserRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isSupervisor = hasRole("supervisor");
  const isChaplain = hasRole("chaplain");
  const isAdminOrSupervisor = isAdmin || isSupervisor;
  const primaryRole = roles[0] || "officer";

  return {
    roles,
    hasRole,
    isAdmin,
    isSupervisor,
    isChaplain,
    isAdminOrSupervisor,
    primaryRole,
    loading,
  };
};
