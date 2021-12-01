const getCurrentProfile = (): string => {
  return process.env.AWS_PROFILE || '';
};

export { getCurrentProfile };
