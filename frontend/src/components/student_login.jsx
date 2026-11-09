
import { useState } from "react";
import "./librarian_login.css";
import "./student_login.css";

import { api, saveAuthSession } from "../services/api";

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

  // STUDENT LOGIN
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

      const data = await api.post("/api/login", {
        email,
        password,
        role: "student",
      });

      if (!data.user || data.user.role?.toLowerCase() !== "student") {
        setLoginError(
          "This account is not registered as a student."
        );
        return;
      }

      // Save JWT token and student information
      saveAuthSession(data);

      // Notify App.jsx
      onLoginSuccess(data.user);

    } catch (error) {
      console.error("Student login error:", error);

      if (error.status === 401) {
        setLoginError("Invalid email or password.");
      } else if (error.status === 403) {
        setLoginError(
          error.message ||
          "You are not authorized to access this account."
        );
      } else {
        setLoginError(
          error.message ||
          "Unable to connect to the server. Please try again."
        );
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  // STUDENT REGISTRATION
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
    const studentNumber = form.studentNumber.value.trim();
    const program = form.program.value.trim();
    const college = form.college.value.trim();
    const yearLevel = Number(form.yearLevel.value);
    const gender = form.gender.value;

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    try {
      setIsRegisterLoading(true);

      const data = await api.post("/api/users", {
        name: fullName,
        email,
        password,
        student_number: studentNumber,
        program,
        college,
        year_level: yearLevel,
        gender,
      });

      setRegisterSuccess(
        data.message ||
        "Account created successfully! You can now login."
      );

      form.reset();

    } catch (error) {
      console.error("Student registration error:", error);

      if (error.status === 409) {
        setRegisterError(
          error.message || "This email is already registered."
        );
      } else {
        setRegisterError(
          error.message || "Unable to create account. Please try again."
        );
      }
    } finally {
      setIsRegisterLoading(false);
    }
  };

  // SWITCH BACK TO LOGIN
  const switchToLogin = () => {
    setShowRegister(false);
    setRegisterError("");
    setRegisterSuccess("");
    setShowRegisterPassword(false);
    setShowConfirmPassword(false);
  };

  // STUDENT REGISTRATION PAGE
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
              <div className="ls-login-badge">
                STUDENT REGISTRATION
              </div>

              <h1>Create Your Account</h1>

              <p className="ls-login-subtitle">
                Join LibSync and explore your school library.
              </p>

              {registerError && (
                <div className="ls-login-error" role="alert">
                  <i
                    className="bi bi-exclamation-circle-fill"
                    aria-hidden="true"
                  ></i>
                  <span>{registerError}</span>
                </div>
              )}

              {registerSuccess && (
                <div
                  className="ls-student-register-success"
                  role="status"
                >
                  <i
                    className="bi bi-check-circle-fill"
                    aria-hidden="true"
                  ></i>
                  <span>{registerSuccess}</span>
                </div>
              )}

              <form
                className="ls-login-form ls-student-register-form"
                onSubmit={handleRegister}
              >
                <div className="ls-login-field">
                  <label htmlFor="student-register-name">
                    Full Name
                  </label>

                  <div className="ls-login-input-wrap">
                    <i
                      className="bi bi-person"
                      aria-hidden="true"
                    ></i>

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
                  <label htmlFor="student-register-email">
                    Email Address
                  </label>

                  <div className="ls-login-input-wrap">
                    <i
                      className="bi bi-envelope"
                      aria-hidden="true"
                    ></i>

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

                <div className="ls-student-register-grid">
                  <div className="ls-login-field">
                    <label htmlFor="student-register-school-id">School ID</label>
                    <div className="ls-login-input-wrap">
                      <i className="bi bi-card-text" aria-hidden="true"></i>
                      <input
                        id="student-register-school-id"
                        type="text"
                        name="studentNumber"
                        placeholder="Enter your school ID"
                        maxLength={50}
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="ls-login-field">
                    <label htmlFor="student-register-year">Year Level</label>
                    <div className="ls-login-input-wrap ls-register-select-wrap">
                      <i className="bi bi-mortarboard" aria-hidden="true"></i>
                      <select id="student-register-year" name="yearLevel" defaultValue="" required>
                        <option value="" disabled>Select year level</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                        <option value="5">5th Year</option>
                        <option value="6">6th Year</option>
                      </select>
                    </div>
                  </div>

                  <div className="ls-login-field">
                    <label htmlFor="student-register-program">Program</label>
                    <div className="ls-login-input-wrap">
                      <i className="bi bi-journal-bookmark" aria-hidden="true"></i>
                      <input
                        id="student-register-program"
                        type="text"
                        name="program"
                        placeholder="e.g. BS Information Technology"
                        maxLength={100}
                        required
                      />
                    </div>
                  </div>

                  <div className="ls-login-field">
                    <label htmlFor="student-register-college">College</label>
                    <div className="ls-login-input-wrap">
                      <i className="bi bi-building" aria-hidden="true"></i>
                      <input
                        id="student-register-college"
                        type="text"
                        name="college"
                        placeholder="Enter your college"
                        maxLength={150}
                        required
                      />
                    </div>
                  </div>

                  <div className="ls-login-field ls-register-gender-field">
                    <label htmlFor="student-register-gender">Gender</label>
                    <div className="ls-login-input-wrap ls-register-select-wrap">
                      <i className="bi bi-person-vcard" aria-hidden="true"></i>
                      <select id="student-register-gender" name="gender" defaultValue="" required>
                        <option value="" disabled>Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="ls-login-field">
                  <label htmlFor="student-register-password">
                    Password
                  </label>

                  <div className="ls-login-input-wrap">
                    <i
                      className="bi bi-lock"
                      aria-hidden="true"
                    ></i>

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
                      onClick={() =>
                        setShowRegisterPassword((value) => !value)
                      }
                      aria-label={
                        showRegisterPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <i
                        className={`bi ${
                          showRegisterPassword
                            ? "bi-eye-slash"
                            : "bi-eye"
                        }`}
                        aria-hidden="true"
                      ></i>
                    </button>
                  </div>
                </div>

                <div className="ls-login-field">
                  <label htmlFor="student-confirm-password">
                    Confirm Password
                  </label>

                  <div className="ls-login-input-wrap">
                    <i
                      className="bi bi-shield-lock"
                      aria-hidden="true"
                    ></i>

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
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <i
                        className={`bi ${
                          showConfirmPassword
                            ? "bi-eye-slash"
                            : "bi-eye"
                        }`}
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
                  <span>
                    {isRegisterLoading
                      ? "Creating account..."
                      : "Create Account"}
                  </span>

                  {!isRegisterLoading && (
                    <i
                      className="bi bi-arrow-right"
                      aria-hidden="true"
                    ></i>
                  )}
                </button>
              </form>

              <div className="ls-student-register-switch">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchToLogin}
                >
                  Login
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  // STUDENT LOGIN PAGE
  return (
    <main className="ls-login-page">
      <section
        className="ls-login-card"
        aria-label="LibSync student login"
      >
        <aside className="ls-login-visual">
          <button
            type="button"
            className="ls-login-back"
            onClick={onBack}
          >
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>Back to Home</span>
          </button>
        </aside>

        <section className="ls-login-form-panel">
          <div className="ls-login-content">
            <div className="ls-login-badge">
              STUDENT PORTAL
            </div>

            <h1>Welcome Back</h1>

            <p className="ls-login-subtitle">
              Sign in to explore your school library.
            </p>

            {loginError && (
              <div className="ls-login-error" role="alert">
                <i
                  className="bi bi-exclamation-circle-fill"
                  aria-hidden="true"
                ></i>
                <span>{loginError}</span>
              </div>
            )}

            <form
              className="ls-login-form"
              onSubmit={handleLogin}
            >
              <div className="ls-login-field">
                <label htmlFor="student-login-email">
                  Email Address
                </label>

                <div className="ls-login-input-wrap">
                  <i
                    className="bi bi-envelope"
                    aria-hidden="true"
                  ></i>

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
                <label htmlFor="student-login-password">
                  Password
                </label>

                <div className="ls-login-input-wrap">
                  <i
                    className="bi bi-lock"
                    aria-hidden="true"
                  ></i>

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
                    onClick={() =>
                      setShowLoginPassword((value) => !value)
                    }
                    aria-label={
                      showLoginPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <i
                      className={`bi ${
                        showLoginPassword
                          ? "bi-eye-slash"
                          : "bi-eye"
                      }`}
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
                <span>
                  {isLoginLoading ? "Signing in..." : "Login"}
                </span>

                {!isLoginLoading && (
                  <i
                    className="bi bi-arrow-right"
                    aria-hidden="true"
                  ></i>
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
              <i
                className="bi bi-book-half"
                aria-hidden="true"
              ></i>

              <span>
                Discover books and manage your library borrowing activity.
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default StudentLogin;

