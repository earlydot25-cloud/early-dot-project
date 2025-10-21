import React from "react";
import { useNavigate } from "react-router-dom";
import EarlyDotWordmark from "../assets/NormalSizeLogo"; // 코드형 로고

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
};
const PageButton: React.FC<BtnProps> = ({ variant = "solid", style, children, ...rest }) => {
  const base: React.CSSProperties = {
    width: "100%",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 600,
    outline: "none",
    cursor: "pointer",
    transition: "box-shadow .15s ease, transform .02s ease",
  };
  const solid: React.CSSProperties = {
    color: "#fff",
    background: "linear-gradient(90deg,#7C3AED,#EC4899)",
    boxShadow: "0 2px 6px rgba(0,0,0,.15)",
    border: "none",
  };
  const outline: React.CSSProperties = {
    color: "#6d28d9",
    background: "#fff",
    border: "1px solid #a78bfa",
  };
  return (
    <button style={{ ...base, ...(variant === "outline" ? outline : solid), ...style }} {...rest}>
      {children}
    </button>
  );
};

type Props = { onLogin?: () => void; onSignup?: () => void; serviceName?: string; };

const BeforeLoginPage: React.FC<Props> = ({ onLogin, onSignup}) => {
  const navigate = useNavigate();
  const handleLogin = onLogin ?? (() => navigate("/login"));
  const handleSignup = onSignup ?? (() => navigate("/signup"));

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        minHeight: "100dvh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "0 24px",
        paddingTop: "12dvh",
        textAlign: "center",
        background: "#fff",
        overflow: "hidden",
      }}
      data-testid="before-login-page"
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 260,
          height: 260,
          borderRadius: "50%",
          filter: "blur(60px)",
          opacity: 0.4,
          background:
            "radial-gradient(60% 60% at 50% 45%, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.55) 55%, rgba(251,113,133,0.45) 85%, rgba(34,211,238,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", marginBottom: 24, zIndex: 10 }}>
        <EarlyDotWordmark height={84} />
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: 420, zIndex: 10 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <PageButton onClick={handleLogin} aria-label="로그인으로 이동">로그인</PageButton>
          <PageButton variant="outline" onClick={handleSignup} aria-label="회원가입으로 이동">
            회원가입
          </PageButton>
        </div>
      </div>
    </div>
  );
};

export default BeforeLoginPage;
