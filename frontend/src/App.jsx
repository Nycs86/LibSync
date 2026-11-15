
import { useState, useEffect } from "react";
import "./App.css";

import Home from "./components/home";
import AdminLogin from "./components/admin_login";
import AdminDashboard from "./components/admin_dashboard";
import LibrarianLogin from "./components/librarian_login";
import LibrarianDashboard from "./components/librarian_dashboard";
import StudentLogin from "./components/student_login";
import StudentDashboard from "./components/student_dashboard";
import GuestDashboard from "./components/guest_dashboard";

import {
  getAccessToken,
  getStoredUser,
  clearAuthSession,
} from "./services/api";

function App() {
  const [selectedRole, setSelectedRole] = useState(() =>
    window.location.hash === "#admin-login" ? "Admin" : ""
  );
  const [isGuestBrowsing, setIsGuestBrowsing] = useState(false);
  const [studentLoginView, setStudentLoginView] = useState("login");

  // Restore session when the page is refreshed
  const [currentUser, setCurrentUser] = useState(() => {
    // Give direct Admin Login URL priority over saved sessions
    if (window.location.hash === "#admin-login") {
      clearAuthSession();
      return null;
    }

    const token = getAccessToken();
    const user = getStoredUser();

    const validRoles = ["admin", "librarian", "student"];
    const role = user?.role?.toLowerCase();

    if (token && user && validRoles.includes(role)) {
      return user;
    }

    clearAuthSession();
    return null;
  });

  // Handle direct URL navigation to Admin Login
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#admin-login") {
        clearAuthSession();
        setCurrentUser(null);
        setSelectedRole("Admin");
      } else {
        setSelectedRole((current) =>
          current === "Admin" ? "" : current
        );
      }
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Remove URL hash
  const clearLoginHash = () => {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  };

  // LOGIN SUCCESS
  const handleLoginSuccess = (user) => {
    const authenticatedUser = user || getStoredUser();

    if (!authenticatedUser || !getAccessToken()) {
      console.error(
        "Login succeeded but authentication session was not saved."
      );
      return;
    }

    setCurrentUser(authenticatedUser);
    setSelectedRole("");
    setIsGuestBrowsing(false);
    setStudentLoginView("login");
    clearLoginHash();
  };

  // LOGOUT
  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setSelectedRole("");
    setIsGuestBrowsing(false);
    setStudentLoginView("login");

    clearLoginHash();
  };

  // DASHBOARDS
  if (currentUser) {
    const role = currentUser.role?.toLowerCase();

    if (role === "admin") {
      return <AdminDashboard onLogout={handleLogout} />;
    }

    if (role === "librarian") {
      return <LibrarianDashboard onLogout={handleLogout} />;
    }

    if (role === "student") {
      return <StudentDashboard onLogout={handleLogout} />;
    }
  }

  // PUBLIC GUEST CATALOGUE — browsing only; no guest role or auth session.
  if (isGuestBrowsing) {
    return (
      <GuestDashboard
        onLogin={() => {
          setIsGuestBrowsing(false);
          setStudentLoginView("login");
          setSelectedRole("Student");
        }}
        onRegister={() => {
          setIsGuestBrowsing(false);
          setStudentLoginView("register");
          setSelectedRole("Student");
        }}
      />
    );
  }

  // ADMIN LOGIN
  if (selectedRole === "Admin") {
    return (
      <AdminLogin
        onBack={() => {
          clearLoginHash();
          setSelectedRole("");
        }}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // LIBRARIAN LOGIN
  if (selectedRole === "Librarian") {
    return (
      <LibrarianLogin
        onBack={() => setSelectedRole("")}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // STUDENT LOGIN
  if (selectedRole === "Student") {
    return (
      <StudentLogin
        key={studentLoginView}
        initialView={studentLoginView}
        onBack={() => {
          setSelectedRole("");
          setStudentLoginView("login");
        }}
        onBrowseAsGuest={() => {
          setSelectedRole("");
          setIsGuestBrowsing(true);
          setStudentLoginView("login");
        }}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // LIBSYNC HOMEPAGE
  return (
    <Home
      onSelectRole={(role) => setSelectedRole(role)}
    />
  );
}

export default App;
