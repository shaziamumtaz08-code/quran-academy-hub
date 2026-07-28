# Quran Academy Hub

You are a senior full-stack web developer.

Build a clean, lightweight LMS web application for an online Quran academy with a one-to-one teaching model.

Scope:
- No video or audio calling features
- Manual attendance entry only
- Web-based system (no mobile app)

Core Roles:
1. Admin
2. Teacher
3. Student
4. Parent (read-only)

Authentication:
- Email and password login
- Role-based access control

Admin Features:
- Create and manage teachers
- Create and manage students
- Assign one teacher to one student
- Define class schedule (days, time, duration)
- Define custom monthly fee per student
- View attendance records
- View lesson plans
- View monthly reports
- View teacher KPI scores
- Mark teacher payments as paid/unpaid

Teacher Features:
- View today's assigned classes
- Mark class attendance manually (Present / Absent / Late)
- Enter lesson covered
- Enter homework or notes
- View own monthly teaching summary

Student / Parent Features:
- View class schedule
- View attendance summary
- View lessons covered
- View monthly progress summary
- View fee status (paid / unpaid)

System Requirements:
- Relational database design
- Clean admin dashboard
- Simple, respectful Islamic-themed UI
- Soft colors, no faces, professional layout

Deliverables:
- Database schema
- Backend API
- Frontend pages
- Basic styling

Use any modern web stack you prefer.
Focus on clarity, simplicity, and correctness.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://alqurantimeacademy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/205c6690-e8af-4742-9dce-ca0cd7736df2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
