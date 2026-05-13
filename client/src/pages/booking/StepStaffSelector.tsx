import { clsx } from 'clsx';
import { ChevronRight, User } from 'lucide-react';
import type { StaffMember } from '@shared/schema';

interface StepStaffSelectorProps {
  staffList: StaffMember[] | undefined;
  selectedStaff: StaffMember | null;
  onSelectStaff: (staff: StaffMember | null) => void;
  onNext: () => void;
}

export function StepStaffSelector({
  staffList,
  selectedStaff,
  onSelectStaff,
  onNext,
}: StepStaffSelectorProps): JSX.Element {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-bold mb-2">Choose Your Professional</h2>
      <p className="text-slate-500 text-sm mb-6">Select who you'd like to work with, or choose any available professional.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {/* Any Professional option */}
        <button
          onClick={() => onSelectStaff(null)}
          className={clsx(
            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
            selectedStaff === null
              ? "border-primary bg-primary/5"
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <span className="font-semibold text-sm text-center">Any Professional</span>
        </button>
        {/* Staff member cards */}
        {staffList?.map(member => (
          <button
            key={member.id}
            onClick={() => onSelectStaff(member)}
            className={clsx(
              "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
              selectedStaff?.id === member.id
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            {member.profileImageUrl ? (
              <img src={member.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                {member.firstName[0]}{member.lastName[0]}
              </div>
            )}
            <div className="text-center">
              <p className="font-semibold text-sm">{member.firstName} {member.lastName}</p>
              {member.bio && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{member.bio}</p>}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
      >
        Continue to Schedule <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
