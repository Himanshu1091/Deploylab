import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'manager', 'employee'];

// Cost 12 is roughly 250ms per hash on modern hardware — slow enough to make
// offline cracking expensive, fast enough that logins stay responsive.
const BCRYPT_COST = 12;

// bcrypt silently truncates input beyond 72 bytes, so a longer password would
// give a false sense of strength.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [60, 'Name must be at most 60 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email must be at most 254 characters.'],
    },

    // select: false keeps the hash out of every query result unless a caller
    // explicitly asks for it. "Never leak the hash" becomes the default rather
    // than something each call site has to remember.
    passwordHash: {
      type: String,
      required: [true, 'Password is required.'],
      select: false,
    },

    role: {
      type: String,
      enum: { values: ROLES, message: `Role must be one of: ${ROLES.join(', ')}.` },
      default: 'employee',
      index: true,
    },

    // Self-referencing: a manager is just a user other users point at.
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

/**
 * Write-only virtual. Assigning `user.password = 'plaintext'` stashes the value
 * on the document; the pre-validate hook below turns it into `passwordHash`.
 *
 * There is no getter — plaintext is never readable back off the document.
 */
userSchema
  .virtual('password')
  .set(function setPassword(plain) {
    this.$locals.plainPassword = plain;
  });

/**
 * Hashing happens on `validate`, not `save`.
 *
 * Mongoose runs validation before save hooks, so a `pre('save')` hook would fire
 * after `passwordHash` had already been checked as required — meaning the field
 * would have to be populated with plaintext first just to pass validation.
 * Doing it here means the plaintext never occupies the field at all.
 */
userSchema.pre('validate', async function hashPassword() {
  const plain = this.$locals.plainPassword;
  if (!plain) return;

  if (typeof plain !== 'string' || plain.length < PASSWORD_MIN || plain.length > PASSWORD_MAX) {
    // invalidate() marks the path as failed and lets validation reject normally,
    // so the caller receives a standard Mongoose ValidationError.
    this.invalidate(
      'password',
      `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`
    );
    return;
  }

  this.passwordHash = await bcrypt.hash(plain, BCRYPT_COST);
  this.$locals.plainPassword = undefined;
});

/**
 * Requires the document to have been loaded with `.select('+passwordHash')`.
 * Returns false rather than throwing when the hash is absent, so a caller who
 * forgot the select gets a failed login rather than a 500.
 */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

/** Login lookup. Email is stored lowercase, so comparison is case-insensitive. */
userSchema.statics.findByEmail = function findByEmail(email, { withPassword = false } = {}) {
  const query = this.findOne({ email: String(email).toLowerCase().trim() });
  return withPassword ? query.select('+passwordHash') : query;
};

const User = mongoose.model('User', userSchema);

export default User;
