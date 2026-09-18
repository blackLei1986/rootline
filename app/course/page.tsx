import type { Metadata } from "next";
import { CourseOverview } from "@/components/course-overview";

export const metadata: Metadata = { title: "学习路径" };

export default function CoursePage() { return <CourseOverview />; }
