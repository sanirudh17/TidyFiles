"use client";

import { useEffect } from "react";
import Link from "next/link";
import "../../marketing.css";
import { supabase } from "@/lib/supabase";

export default function SignUpPage() {
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

    const handleFAQ = () => {
        document.querySelectorAll(".faq-question").forEach((button) => {
            // Remove previous event listeners by cloning
            const newButton = button.cloneNode(true) as HTMLElement;
            if(button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            newButton.addEventListener("click", () => {
                const item = newButton.closest(".faq-item");
                if (!item) {
                    return;
                }
                const isOpen = item.classList.toggle("is-open");
                newButton.setAttribute("aria-expanded", String(isOpen));
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
            const { data, error } = await supabase.auth.signUp({
                email: emailInput.value,
                password: passwordInput.value,
                options: {
                    emailRedirectTo: window.location.origin + '/scan',
                },
            });

            if (error) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create account';
                if (messageBox) {
                    // Provide user-friendly messages for common errors
                    if (error.message.toLowerCase().includes('rate limit')) {
                        messageBox.innerHTML = 'Too many sign-up attempts. Please wait a few minutes and try again, or <a href="/signin" style="color: inherit; text-decoration: underline; font-weight: 600;">try signing in</a> if you already have an account.';
                    } else if (error.message.toLowerCase().includes('already registered')) {
                        messageBox.innerHTML = 'This email is already registered. <a href="/signin" style="color: inherit; text-decoration: underline; font-weight: 600;">Sign in instead</a>.';
                    } else {
                        messageBox.textContent = error.message;
                    }
                    messageBox.classList.add("is-visible", "is-info");
                }
                return;
            }

            // Check if user was confirmed immediately (autoconfirm enabled)
            // or if confirmation email was sent
            const needsConfirmation = data?.user?.identities?.length === 0;
            if (needsConfirmation) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create account';
                if (messageBox) {
                    messageBox.innerHTML = 'This email is already registered. <a href="/signin" style="color: inherit; text-decoration: underline; font-weight: 600;">Sign in instead</a>.';
                    messageBox.classList.add("is-visible", "is-info");
                }
                return;
            }

            // Since email confirmations should be disabled from settings, this logs them right in and redirects them
            if (messageBox) {
                messageBox.textContent = "Account created successfully! Redirecting...";
                messageBox.classList.add("is-visible", "is-success");
            }
            
            window.setTimeout(() => {
                window.location.href = '/signin';
            }, 1200);
        });
    });

    handleMobileMenu();
    handleAnimations();
    handleSmoothScroll();
    handleFAQ();
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
                <a href="/signin" className="btn btn-primary">Sign in</a>
            </div>
        </div>
    </header>

    <main>
        <section className="container auth-simple-layout">
            <div className="auth-simple-card animate-up visible">
                <div className="eyebrow">Create account</div>
                <h1>Set up TidyFiles</h1>
                <p>Create a simple email and password account now, then connect it to Supabase later.</p>
                <form className="auth-form" data-auth-mode="signup">
                    <div className="form-field">
                        <label htmlFor="signup-email">Email</label>
                        <input id="signup-email" name="email" type="email" placeholder="you@company.com" required />
                    </div>
                    <div className="form-field">
                        <label htmlFor="signup-password">Password</label>
                        <input id="signup-password" name="password" type="password" placeholder="Create a password" required />
                    </div>
                    <div className="auth-message" id="auth-message"></div>
                    <button type="submit" className="btn btn-primary btn-block">Create account</button>
                </form>
                <p className="auth-switch">Already have an account? <a href="/signin">Sign in</a>.</p>
            </div>
        </section>
    </main>
    </>
  );
}
