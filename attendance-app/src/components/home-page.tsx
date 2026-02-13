"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Users,
    ScanFace
} from "lucide-react";

const HomePage = () => {
    // Animation variants for staggered reveal
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    };

    return (
        <div className="flex flex-col items-center justify-center">
            {/* Hero Section */}
            <section className="w-full py-10 md:py-16 lg:py-25 bg-linear-to-b from-background to-muted/20">
                <motion.div
                    className="container px-4 md:px-6 text-center"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants} className="space-y-4">
                        <img
                            src="/icons/Snap-Attend-bgless.svg"
                            alt="SnapAttend Logo"
                            className="w-40 h-40 md:w-52 md:h-52 lg:w-64 lg:h-64 flex justify-center mx-auto"
                        />
                        <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-linear-to-r from-primary to-blue-600 dark:to-blue-400">
                            Attendance in a Snap.
                        </h1>
                        <p className="mx-auto max-w-175 text-muted-foreground md:text-xl">
                            Forget roll calls. Teachers upload a class photo, our AI identifies the students,
                            and attendance is marked instantly.
                        </p>
                    </motion.div>
                    <motion.div variants={itemVariants} className="mt-8 flex justify-center gap-4">
                        <Link href="/login?role=teacher">
                            <Button size="lg" className="gap-2 cursor-pointer">
                                Teacher Login <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/login?role=student">
                            <Button size="lg" variant="outline" className="gap-2 cursor-pointer">
                                Student Portal
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* Features Grid */}
            <section className="container px-4 py-16 md:py-24">
                <div className="grid gap-8 md:grid-cols-3">
                    <FeatureCard
                        icon={<Users className="h-10 w-10 text-primary" />}
                        title="Classroom Management"
                        description="Create digital classrooms easily. Students join via code and manage their profiles."
                    />
                    <FeatureCard
                        icon={<ScanFace className="h-10 w-10 text-primary" />}
                        title="Face Recognition"
                        description="Powered by Python AI, we detect faces from a group photo with high accuracy."
                    />
                    <FeatureCard
                        icon={<CheckCircle2 className="h-10 w-10 text-primary" />}
                        title="Instant Reports"
                        description="Attendance is updated in real-time. Export reports and track attendance history."
                    />
                </div>
            </section>
        </div>
    );
};

// Simple Helper Component for the features
function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="flex flex-col items-center text-center p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all"
        >
            <div className="mb-4 p-3 bg-primary/10 rounded-full">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </motion.div>
    )
}

export default HomePage;