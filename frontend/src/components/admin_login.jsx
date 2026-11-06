import { useState } from "react";
import { api, saveAuthSession } from "../services/api";
import "./librarian_login.css";

function AdminLogin({ onLoginSuccess, onBack }) {
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
    <main className="ls-login-page">
      <section className="ls-login-card" aria-label="LibSync administrator login">
        <aside
          className="ls-login-visual"
          aria-label="LibSync library branding"
        >
          {onBack && (
            <button type="button" className="ls-login-back" onClick={onBack}>
              <i className="bi bi-arrow-left" aria-hidden="true" />
              <span>Back to Home</span>
            </button>
          )}
        </aside>

        <section className="ls-login-form-panel">
          <div className="ls-login-content">
            <div className="ls-login-badge">ADMINISTRATOR PORTAL</div>
            <h1>Welcome Back</h1>
            <p className="ls-login-subtitle">
              Sign in to manage the LibSync system.
            </p>

            {loginError && (
              <div className="ls-login-error" role="alert">
                <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}

            <form className="ls-login-form" onSubmit={handleLogin}>
              <div className="ls-login-field">
                <label htmlFor="admin-email">Email Address</label>
                <div className="ls-login-input-wrap">
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

              <div className="ls-login-field">
                <label htmlFor="admin-password">Password</label>
                <div className="ls-login-input-wrap">
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
                    className="ls-password-toggle"
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

              <div className="ls-login-options">
                <span />
                <button
                  type="button"
                  className="ls-forgot-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <button className="ls-login-submit" type="submit" disabled={isLoading}>
                <span>{isLoading ? "Signing in..." : "Login"}</span>
                {!isLoading && <i className="bi bi-arrow-right" aria-hidden="true" />}
              </button>
            </form>

            <div className="ls-admin-notice">
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
