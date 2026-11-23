import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, ExternalLink } from 'lucide-react';
import SEOHead from '../src/components/common/SEOHead';

const PrivacyPolicyPage: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <SEOHead
                title="Privacy Policy | Unique Delta Force Security"
                description="Read the official Privacy Policy and data protection guidelines of Unique Delta Force Pvt Ltd."
                canonicalUrl="https://udfonline.in/privacy-policy"
            />
            {/* Navigation Bar */}
            <nav className="bg-white shadow-xs sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="flex items-center space-x-3 cursor-pointer">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <ExternalLink className="text-white h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold text-gray-900 tracking-tight">Unique Delta Force</span>
                        </a>
                        <div className="flex items-center space-x-6">
                            <a href="/about" onClick={(e) => { e.preventDefault(); navigate('/about'); }} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">About Us</a>
                            <a href="/careers" onClick={(e) => { e.preventDefault(); navigate('/careers'); }} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Careers</a>
                            <a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Contact</a>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="flex-grow">

            {/* Page Header */}
            <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <ShieldCheck className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Privacy Policy & Cookie Disclosure</h1>
                    <p className="text-slate-300 text-sm">Effective Date: June 29, 2026</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
                <button
                    onClick={() => navigate('/')}
                    className="mb-8 flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors group"
                >
                    <ArrowLeft className="mr-1.5 h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                    Back to Homepage
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 leading-relaxed text-gray-600 space-y-8">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
                        <p className="mb-2">
                            Unique Delta Force Pvt Ltd ("we", "us", or "our") operates the corporate portal, careers, and HR management system. We are committed to protecting the privacy of our candidates, employees, and portal visitors.
                        </p>
                        <p>
                            This Privacy Policy documents the types of information collected, processed, and stored by our platform, and our practices regarding cookies and personalized advertisements.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
                        <p className="mb-2">
                            When you apply for a job or register as an employee on our site, we collect:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5 mb-4">
                            <li><strong>Personal Identity Data:</strong> Full Name, Date of Birth, Gender, Passport Photo.</li>
                            <li><strong>Contact Information:</strong> Phone Number, Email Address, Residential Address.</li>
                            <li><strong>Employment Documentation:</strong> Educational qualifications, previous job experience records, Aadhaar Card, PAN Card details.</li>
                            <li><strong>Financial Details:</strong> Bank Name, Account Number, IFSC code (exclusively used for salary disbursement and statutory PF/ESI registration).</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
                        <p className="mb-2">
                            We use the collected information for:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Verifying applicant identity and conducting background checks.</li>
                            <li>Facilitating onboarding and regulatory enrollment in EPFO (Employees' Provident Fund) and ESIC (Employees' State Insurance).</li>
                            <li>Processing monthly salary payments and tracking attendance.</li>
                            <li>Improving website navigation, security, and administrative efficiency.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Cookies & Website Analytics</h2>
                        <p className="mb-3">
                            We use essential and functional cookies strictly to maintain user authentication sessions and secure form submissions across our portals. We do not deploy third-party commercial advertising tracking cookies or ad networks.
                        </p>
                        <p className="mb-3 font-semibold text-gray-800">
                            Our cookie and data privacy policies ensure:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mb-4">
                            <li>Essential session cookies are utilized only to keep authorized staff and employees authenticated securely.</li>
                            <li>No personal user information is shared or sold to commercial advertising networks or data brokers.</li>
                            <li>Should third-party analytics or services be used, you may opt out of third-party cookies by visiting <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">AboutAds.info <ExternalLink size={12} className="ml-0.5" /></a>.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Retention & Security</h2>
                        <p className="mb-2">
                            All user profiles, documents, and application records are stored securely using Firebase Security rules. We implement strict transport layer security (TLS) and authorization keys to ensure that data is accessible only by authorized HR personnel and Administrators.
                        </p>
                        <p>
                            Personal data is retained only for the duration of the recruitment process or active employment tenure, plus any statutory period required by Indian labor laws.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Consent</h2>
                        <p>
                            By using our website, you hereby consent to our Privacy Policy and agree to its terms. If you do not agree, please do not upload personal documents or consent to the cookie banner.
                        </p>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Compliance Officer Contact</h2>
                        <p className="text-sm">
                            If you have questions, contact us at: <strong>compliance@udfonline.in</strong>.
                        </p>
                    </div>
                </div>
            </div>

            </main>

            {/* Simple Footer */}
            <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4">
                    <p>&copy; {new Date().getFullYear()} Unique Delta Force Security. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default PrivacyPolicyPage;
