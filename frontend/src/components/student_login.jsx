import { useState } from "react";
import "./librarian_login.css";
import "./student_login.css";

function StudentLogin({ onBack, onLoginSuccess }) {
  const [showRegister, setShowRegister] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  const API_URL = "https://libsync-backend.onrender.com";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      setIsLoginLoading(true);

      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role: "student",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setLoginError(data.message || "Invalid email or password.");
        return;
      }

      if (!data.user || data.user.role !== "student") {
        setLoginError("This account is not registered as a student.");
        return;
      }

      sessionStorage.setItem("loggedInUser", JSON.stringify(data.user));
      console.log("Student login successful");
      onLoginSuccess();
    } catch (error) {
      console.error("Student login error:", error);
      setLoginError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");

    const form = e.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    try {
      setIsRegisterLoading(true);

      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRegisterError(data.message || "Unable to create account.");
        return;
      }

      setRegisterSuccess("Account created successfully! You can now login.");
      form.reset();
    } catch (error) {
      console.error("Student registration error:", error);
      setRegisterError("Unable to connect to the server. Please try again.");
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const switchToLogin = () => {
    setShowRegister(false);
    setRegisterError("");
    setRegisterSuccess("");
    setShowRegisterPassword(false);
    setShowConfirmPassword(false);
  };

  if (showRegister) {
    return (
      <main className="ls-login-page ls-student-register-page">
        <section
          className="ls-login-card ls-student-register-card"
          aria-label="LibSync student registration"
        >
          <aside className="ls-login-visual">
            <button
              type="button"
              className="ls-login-back"
              onClick={switchToLogin}
            >
              <i className="bi bi-arrow-left" aria-hidden="true"></i>
              <span>Back to Login</span>
            </button>
          </aside>

          <section className="ls-login-form-panel ls-student-register-panel">
            <div className="ls-login-content ls-student-register-content">
              <div className="ls-login-badge">STUDENT REGISTRATION</div>
              <h1>Create Your Account</h1>
              <p className="ls-login-subtitle">
                Join LibSync and explore your school library.
              </p>

              {registerError && (
                <div className="ls-login-error" role="alert">
                  <i className="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
                  <span>{registerError}</span>
                </div>
              )}

              {registerSuccess && (
                <div className="ls-student-register-success" role="status">
                  <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                  <span>{registerSuccess}</span>
                </div>
              )}

              <form
                className="ls-login-form ls-student-register-form"
                onSubmit={handleRegister}
              >
                <div className="ls-login-field">
                  <label htmlFor="student-register-name">Full Name</label>
                  <div className="ls-login-input-wrap">
                    <i className="bi bi-person" aria-hidden="true"></i>
                    <input
                      id="student-register-name"
                      type="text"
                      name="fullName"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                <div className="ls-login-field">
                  <label htmlFor="student-register-email">Email Address</label>
                  <div className="ls-login-input-wrap">
                    <i className="bi bi-envelope" aria-hidden="true"></i>
                    <input
                      id="student-register-email"
                      type="email"
                      name="email"
                      placeholder="Enter your email address"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="ls-login-field">
                  <label htmlFor="student-register-password">Password</label>
                  <div className="ls-login-input-wrap">
                    <i className="bi bi-lock" aria-hidden="true"></i>
                    <input
                      id="student-register-password"
                      type={showRegisterPassword ? "text" : "password"}
                      name="password"
                      placeholder="Create a password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="ls-password-toggle"
                      onClick={() => setShowRegisterPassword((value) => !value)}
                      aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                    >
                      <i
                        className={`bi ${showRegisterPassword ? "bi-eye-slash" : "bi-eye"}`}
                        aria-hidden="true"
                      ></i>
                    </button>
                  </div>
                </div>

                <div className="ls-login-field">
                  <label htmlFor="student-confirm-password">Confirm Password</label>
                  <div className="ls-login-input-wrap">
                    <i className="bi bi-shield-lock" aria-hidden="true"></i>
                    <input
                      id="student-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="ls-password-toggle"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <i
                        className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}
                        aria-hidden="true"
                      ></i>
                    </button>
                  </div>
                </div>

                <button
                  className="ls-login-submit"
                  type="submit"
                  disabled={isRegisterLoading}
                >
                  <span>{isRegisterLoading ? "Creating account..." : "Create Account"}</span>
                  {!isRegisterLoading && (
                    <i className="bi bi-arrow-right" aria-hidden="true"></i>
                  )}
                </button>
              </form>

              <div className="ls-student-register-switch">
                Already have an account?{" "}
                <button type="button" onClick={switchToLogin}>
                  Login
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="ls-login-page">
      <section className="ls-login-card" aria-label="LibSync student login">
        <aside className="ls-login-visual">
          <button type="button" className="ls-login-back" onClick={onBack}>
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>Back to Home</span>
          </button>
        </aside>

        <section className="ls-login-form-panel">
          <div className="ls-login-content">
            <div className="ls-login-badge">STUDENT PORTAL</div>
            <h1>Welcome Back</h1>
            <p className="ls-login-subtitle">
              Sign in to explore your school library.
            </p>

            {loginError && (
              <div className="ls-login-error" role="alert">
                <i className="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
                <span>{loginError}</span>
              </div>
            )}

            <form className="ls-login-form" onSubmit={handleLogin}>
              <div className="ls-login-field">
                <label htmlFor="student-login-email">Email Address</label>
                <div className="ls-login-input-wrap">
                  <i className="bi bi-envelope" aria-hidden="true"></i>
                  <input
                    id="student-login-email"
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="ls-login-field">
                <label htmlFor="student-login-password">Password</label>
                <div className="ls-login-input-wrap">
                  <i className="bi bi-lock" aria-hidden="true"></i>
                  <input
                    id="student-login-password"
                    type={showLoginPassword ? "text" : "password"}
                    name="loginPassword"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="ls-password-toggle"
                    onClick={() => setShowLoginPassword((value) => !value)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    <i
                      className={`bi ${showLoginPassword ? "bi-eye-slash" : "bi-eye"}`}
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
              </div>

              <button
                className="ls-login-submit"
                type="submit"
                disabled={isLoginLoading}
              >
                <span>{isLoginLoading ? "Signing in..." : "Login"}</span>
                {!isLoginLoading && (
                  <i className="bi bi-arrow-right" aria-hidden="true"></i>
                )}
              </button>
            </form>

            <div className="ls-student-login-switch">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  setLoginError("");
                }}
              >
                Register
              </button>
            </div>

            <div className="ls-admin-notice ls-student-login-notice">
              <i className="bi bi-book-half" aria-hidden="true"></i>
              <span>Discover books and manage your library borrowing activity.</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default StudentLogin;
