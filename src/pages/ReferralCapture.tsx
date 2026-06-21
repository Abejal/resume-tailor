import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const REF_KEY = "jobtailor_ref";

export default function ReferralCapture() {
  const { code } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    if (code && /^[a-z0-9]{4,32}$/.test(code)) {
      localStorage.setItem(REF_KEY, code);
      toast.success(`Referral code applied — sign up to get +3 bonus credits`);
    }
    nav("/signup", { replace: true });
  }, [code, nav]);

  return null;
}
