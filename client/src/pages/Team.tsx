import { Users, Award, Heart, Star } from "lucide-react";

export default function Team() {
  return (
    <div className="pt-24 pb-20">
      <section className="container-custom mx-auto mb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Our Team</h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8">
            Meet the dedicated professionals who bring excellence to every cleaning service. Our team is background-checked, highly trained, and committed to delivering outstanding results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          {[
            {
              icon: Users,
              title: "Professional Staff",
              desc: "Every team member undergoes thorough background checks and comprehensive training."
            },
            {
              icon: Award,
              title: "Certified Experts",
              desc: "Our cleaners are certified in the latest cleaning techniques and safety protocols."
            },
            {
              icon: Heart,
              title: "Passionate Service",
              desc: "We take pride in our work and treat every home with care and respect."
            },
            {
              icon: Star,
              title: "Quality Focus",
              desc: "Consistently delivering exceptional results that exceed expectations."
            }
          ].map((item, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <item.icon className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 text-white py-20">
        <div className="container-custom mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Why Choose Our Team</h2>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            When you book with Skleanings, you're not just getting a cleaning service – you're getting a team of dedicated professionals who care about your home as much as you do. We invest in our people because we know that great service starts with great team members.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="p-6">
              <div className="text-4xl font-bold text-yellow-400 mb-2">100%</div>
              <div className="text-slate-300">Background Checked</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-yellow-400 mb-2">500+</div>
              <div className="text-slate-300">Happy Customers</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-yellow-400 mb-2">5★</div>
              <div className="text-slate-300">Average Rating</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
