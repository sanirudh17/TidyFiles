"use client";

import { useEffect } from "react";
import Link from "next/link";
import "../../marketing.css";
import { supabase } from "@/lib/supabase";

export default function SignInPage() {
  useEffect(() => {
    // Basic init logic from script.js translated to work within React
    const handleMobileMenu = () => {
        const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
        const mobileNav = document.querySelector(".site-nav-mobile");

        if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener("click", () => {
                const isOpen = mobileNav.classList.toggle("is-open");
                mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
                const icon = mobileMenuToggle.querySelector("i");
                if (icon) {
                    icon.classList.toggle("fa-bars");
                    icon.classList.toggle("fa-xmark");
                }
            });

            mobileNav.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", () => {
                    mobileNav.classList.remove("is-open");
                    mobileMenuToggle.setAttribute("aria-expanded", "false");
                    const icon = mobileMenuToggle.querySelector("i");
                    if (icon) {
                        icon.classList.add("fa-bars");
                        icon.classList.remove("fa-xmark");
                    }
                });
            });
        }
    };

    const handleAnimations = () => {
        const animatedElements = document.querySelectorAll(".animate-up");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    }
                });
            },
            { threshold: 0.16 }
        );

        animatedElements.forEach((element) => observer.observe(element));
    };

    const handleSmoothScroll = () => {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener("click", (event) => {
                const targetId = anchor.getAttribute("href");
                if (!targetId || targetId === "#") {
                    return;
                }

                const target = document.querySelector(targetId);
                if (!target) {
                    return;
                }

                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    };

    const authForms = document.querySelectorAll(".auth-form");
    authForms.forEach((form) => {
        // Remove old listeners
        const newForm = form.cloneNode(true) as HTMLElement;
        if (form.parentNode) {
            form.parentNode.replaceChild(newForm, form);
        }
        newForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submitButton = newForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            const messageBox = newForm.querySelector(".auth-message") as HTMLElement | null;
            if (!submitButton) return;
            
            const emailInput = newForm.querySelector('input[name="email"]') as HTMLInputElement;
            const passwordInput = newForm.querySelector('input[name="password"]') as HTMLInputElement;
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
            
            if (messageBox) {
                messageBox.classList.remove("is-visible", "is-success", "is-info");
                messageBox.textContent = "";
            }

            // Supabase Authentication
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value,
            });

            if (error) {
                // If the user tries to sign in without an account, it will error here
                submitButton.disabled = false;
                submitButton.innerHTML = 'Sign in';
                if (messageBox) {
                    messageBox.textContent = error.message;
                    messageBox.classList.add("is-visible", "is-info");
                }
                return;
            }
            
            // Success, user entered
            if (messageBox) {
                messageBox.textContent = "Sign in successful! Redirecting...";
                messageBox.classList.add("is-visible", "is-success");
            }
            
            // Redirect after brief delay
            window.setTimeout(() => {
                window.location.href = '/scan';
            }, 800);
        });
    });

    handleMobileMenu();
    handleAnimations();
    handleSmoothScroll();
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="container nav-shell">
            <a href="/" className="brand">
                <span className="brand-mark"><i className="fa-solid fa-folder-tree"></i></span>
                <span>
                    <strong>TidyFiles</strong>
                    <small>Safety-first file cleanup</small>
                </span>
            </a>
            <div className="nav-actions">
                <a href="/" className="btn btn-secondary">Back home</a>
                <a href="/signup" className="btn btn-primary">Create account</a>
            </div>
        </div>
    </header>

    <main>
        <section className="container auth-simple-layout">
            <div className="auth-simple-card animate-up visible">
                <div className="eyebrow">Sign in</div>
                <h1>Welcome back</h1>
                <p>Use your email and password to continue.</p>
                <form className="auth-form" data-auth-mode="signin">
                    <div className="form-field">
                        <label htmlFor="signin-email">Email</label>
                        <input id="signin-email" name="email" type="email" placeholder="you@company.com" required />
                    </div>
                    <div className="form-field">
                        <label htmlFor="signin-password">Password</label>
                        <input id="signin-password" name="password" type="password" placeholder="Enter your password" required />
                    </div>
                    <div className="auth-message" id="auth-message"></div>
                    <button type="submit" className="btn btn-primary btn-block">Sign in</button>
                </form>
                <p className="auth-switch">Need an account? <a href="/signup">Create an account here</a>.</p>
            </div>
        </section>
    </main>
    </>
  );
}
