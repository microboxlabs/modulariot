'use client';

import { motion } from 'framer-motion';
import CTAButton from '../CTAButton';

export default function FinalCTASection() {
  const scrollToForm = () => {
    const element = document.getElementById('cta-form');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="cta-form" className="py-20 bg-gradient-to-r from-blue-600 to-orange-500">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-white"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            Ready to own your fleet data?
          </h2>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 leading-relaxed">
            Join forward-thinking companies who chose data ownership over vendor lock-in.
            See your real-time pipeline running in 20 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CTAButton variant="primary" size="lg" className="bg-white text-blue-600 hover:bg-gray-100 border-none">
              Book Integration Call
            </CTAButton>
            <button
              onClick={scrollToForm}
              className="text-white hover:text-blue-100 font-semibold underline underline-offset-4 hover:underline-offset-8 transition-all duration-300"
            >
              or scroll to contact form
            </button>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-8 text-blue-100">
            <div>
              <div className="text-3xl font-bold text-white mb-2">48hr</div>
              <div>Setup time for managed deployment</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">0%</div>
              <div>Data vendor lock-in</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-2">100%</div>
              <div>Your data, your control</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 