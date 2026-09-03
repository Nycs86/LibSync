import { useState } from "react";

function StudentLogin({ onBack }) {
  const [showRegister, setShowRegister] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoginError("");

    const form = e.target;
    const email = form.email.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      const response = await fetch("https://identify-spilt-cover.ngrok-free.dev/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(
          data.message || "Invalid email or password."
        );
        return;
      }

      if (data.user.role !== "student") {
        setLoginError(
          "This account is not registered as a student."
        );
        return;
      }

      localStorage.setItem(
        "loggedInUser",
        JSON.stringify(data.user)
      );

      console.log("Student login successful");

      // Student Dashboard natin ilalagay dito later
    } catch (error) {
      console.error(error);
      setLoginError(
        "Unable to connect to the server."
      );
    }
  };

  const handleRegister = async (e) => {
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

    try {
      const response = await fetch("https://identify-spilt-cover.ngrok-free.dev/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          role: "student",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegisterError(
          data.message || "Unable to create account."
        );
        return;
      }

      setRegisterSuccess(
        "Account created successfully! You can now login."
      );

      form.reset();
    } catch (error) {
      console.error(error);
      setRegisterError(
        "Unable to connect to the server."
      );
    }
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

          <h1>Student Registration</h1>

          <p>
            Create your LibSync student account
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
          <i className="bi bi-mortarboard"></i>
        </div>

        <h1>Student Login</h1>

        <p>
          Access your LibSync student account
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
              placeholder="Enter your email address"
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

export default StudentLogin;