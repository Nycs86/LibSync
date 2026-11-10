import { useState } from "react";
import { api, saveAuthSession } from "../services/api";
import "./admin_login.css";

function AdminLogin({ onLoginSuccess }) {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");

    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      setIsLoading(true);

      const data = await api.post("/api/login", {
        email,
        password,
        role: "admin",
      });

      if (!data.user || String(data.user.role || "").toLowerCase() !== "admin") {
        setLoginError("This account is not registered as an administrator.");
        return;
      }

      // Keep Admin authentication consistent with the Librarian and Student portals.
      // api.js stores the JWT and user in sessionStorage.
      saveAuthSession(data);
      onLoginSuccess(data.user);
    } catch (error) {
      console.error("Admin login error:", error);

      if (error.status === 401) {
        setLoginError("Invalid email or password.");
      } else if (error.status === 403) {
        setLoginError(error.message || "You are not authorized to access this account.");
      } else {
        setLoginError(error.message || "Unable to connect to the server. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setLoginError(
      "Please contact the system owner to reset your administrator password."
    );
  };

  return (
    <main className="ls-admin-login-page">
      <section className="ls-admin-login-card" aria-label="LibSync administrator login">
        <aside
          className="ls-admin-login-visual"
          aria-label="LibSync library branding"
        >
</aside>

        <section className="ls-admin-login-form-panel">
          <div className="ls-admin-login-content">
            <div className="ls-admin-login-badge">ADMINISTRATOR PORTAL</div>
            <h1>Welcome Back</h1>
            <p className="ls-admin-login-subtitle">
              Sign in to manage the LibSync system.
            </p>

            {loginError && (
              <div className="ls-admin-login-error" role="alert">
                <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}

            <form className="ls-admin-login-form" onSubmit={handleLogin}>
              <div className="ls-admin-login-field">
                <label htmlFor="admin-email">Email Address</label>
                <div className="ls-admin-login-input-wrap">
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <input
                    id="admin-email"
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="ls-admin-login-field">
                <label htmlFor="admin-password">Password</label>
                <div className="ls-admin-login-input-wrap">
                  <i className="bi bi-lock" aria-hidden="true" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="ls-admin-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i
                      className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div className="ls-admin-login-options">
                <span />
                <button
                  type="button"
                  className="ls-admin-forgot-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <button className="ls-admin-login-submit" type="submit" disabled={isLoading}>
                <span>{isLoading ? "Signing in..." : "Login"}</span>
              </button>
            </form>

            <div className="ls-admin-login-notice">
              <i className="bi bi-shield-lock" aria-hidden="true" />
              <span>Restricted access. Authorized administrators only.</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default AdminLogin;
