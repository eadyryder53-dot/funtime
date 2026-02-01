import mongoose, { Schema, type InferSchemaType } from "mongoose";

const RefreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    deviceId: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { _id: false }
);

const VerificationSchema = new Schema(
  {
    emailCodeHash: { type: String },
    emailCodeExpiresAt: { type: Date },
    emailVerifiedAt: { type: Date },
    phoneCodeHash: { type: String },
    phoneCodeExpiresAt: { type: Date },
    phoneVerifiedAt: { type: Date },
  },
  { _id: false }
);

const AuthSecretSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    passwordAlgo: { type: String, required: true },
    emailHash: { type: String },
    phoneHash: { type: String },
    verification: {
      type: VerificationSchema,
      required: true,
      default: {},
    },
    refreshTokens: {
      type: [RefreshTokenSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "auth_secrets",
  }
);

export type AuthSecret = InferSchemaType<typeof AuthSecretSchema>;

export const AuthSecretModel =
  (mongoose.models.AuthSecret as mongoose.Model<AuthSecret>) ||
  mongoose.model<AuthSecret>("AuthSecret", AuthSecretSchema);
