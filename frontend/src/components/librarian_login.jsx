import { useState } from "react";

function LibrarianLogin({ onBack }) {
  const [showRegister, setShowRegister] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    setLoginError("");

    const form = e.target;
    const email = form.email.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const registeredLibrarian = JSON.parse(
      localStorage.getItem("librarianAccount")
    );

    if (!registeredLibrarian) {
      setLoginError(
        "Account not found. Please register first."
      );
      return;
    }

    const isCorrectEmail =
      email.toLowerCase() ===
      registeredLibrarian.email.toLowerCase();

    const isCorrectPassword =
      password === registeredLibrarian.password;

    if (!isCorrectEmail || !isCorrectPassword) {
      setLoginError(
        "Invalid email or password."
      );
      return;
    }

    console.log("Librarian login successful");

    // Dashboard natin ilalagay dito later
  };

  const handleRegister = (e) => {
    e.preventDefault();

    setRegisterError("");
    setRegisterSuccess("");

    const form = e.target;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      setRegisterError(
        "Passwords do not match."
      );
      return;
    }

    const existingLibrarian = JSON.parse(
      localStorage.getItem("librarianAccount")
    );

    if (existingLibrarian) {
      if (
        existingLibrarian.email.toLowerCase() ===
        email.toLowerCase()
      ) {
        setRegisterError(
          "Email address is already registered."
        );
        return;
      }
    }

    const librarianAccount = {
      fullName,
      email,
      password,
    };

    localStorage.setItem(
      "librarianAccount",
      JSON.stringify(librarianAccount)
    );

    setRegisterSuccess(
      "Account created successfully! You can now login."
    );

    form.reset();
  };

  if (showRegister) {
    return (
      <div className="login-page">
        <div className="login-card">

          <button
            type="button"
            className="back-button"
            onClick={() => {
              setShowRegister(false);
              setRegisterError("");
              setRegisterSuccess("");
            }}
          >
            Back to Login
          </button>

          <div className="login-icon">
            <i className="bi bi-person-plus"></i>
          </div>

          <h1>Librarian Registration</h1>

          <p>
            Create your LibSync librarian account
          </p>

          {registerError && (
            <div className="form-error">
              {registerError}
            </div>
          )}

          {registerSuccess && (
            <div className="form-success">
              {registerSuccess}
            </div>
          )}

          <form onSubmit={handleRegister}>

            <div className="form-group">
              <label>Full Name</label>

              <input
                type="text"
                name="fullName"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>

              <input
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <input
                type="password"
                name="password"
                placeholder="Create a password"
                minLength="8"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                minLength="8"
                required
              />
            </div>

            <button
              type="submit"
              className="login-button"
            >
              Create Account
            </button>

          </form>

          <div className="register-link">
            Already have an account?{" "}

            <button
              type="button"
              onClick={() => {
                setShowRegister(false);
                setRegisterError("");
                setRegisterSuccess("");
              }}
            >
              Login
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          Back
        </button>

        <div className="login-icon">
          <i className="bi bi-book"></i>
        </div>

        <h1>Librarian Login</h1>

        <p>
          Access your LibSync librarian account
        </p>

        {loginError && (
          <div className="form-error">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <div className="form-group">
            <label>
              Email Address
            </label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              name="loginPassword"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
          >
            Login
          </button>

        </form>

        <div className="register-link">
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

      </div>
    </div>
  );
}

export default LibrarianLogin;